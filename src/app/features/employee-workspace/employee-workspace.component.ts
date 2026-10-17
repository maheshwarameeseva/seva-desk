import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs/operators';

export interface CatalogCategory {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly description?: string;
}

export interface CatalogServiceItem {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string;
  readonly state: string;
  readonly url: string;
  readonly image?: string;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly source: string;
  readonly verifiedOn?: string;
  readonly active: boolean;
}

interface CatalogPayload {
  readonly categories: readonly CatalogCategory[];
  readonly services: readonly CatalogServiceItem[];
}

interface GroupedServices {
  readonly category: CatalogCategory;
  readonly services: readonly CatalogServiceItem[];
}

@Component({
  selector: 'app-employee-workspace',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-workspace.component.html',
  styleUrl: './employee-workspace.component.scss',
})
export class EmployeeWorkspaceComponent implements AfterViewInit {
  private readonly http = inject(HttpClient);

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  readonly fallbackImage = 'assets/catalog/fallback.svg';
  readonly query = signal('');
  readonly selectedCategory = signal('all');
  readonly catalog = signal<CatalogPayload | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly imageFallbacks = signal<Record<string, boolean>>({});

  readonly categoryOptions = computed(() => [{ id: 'all', name: 'All categories' }, ...(this.catalog()?.categories ?? [])]);

  readonly filteredGroups = computed<readonly GroupedServices[]>(() => {
    const payload = this.catalog();
    if (!payload) {
      return [];
    }

    const selectedCategory = this.selectedCategory();
    const normalizedQuery = this.normalize(this.query());

    const groups = payload.categories
      .map((category) => ({
        category,
        services: payload.services.filter((service) => {
          if (!service.active || service.categoryId !== category.id) {
            return false;
          }

          if (selectedCategory !== 'all' && service.categoryId !== selectedCategory) {
            return false;
          }

          if (!normalizedQuery) {
            return true;
          }

          const haystack = [
            service.title,
            service.description,
            service.state,
            service.source,
            category.name,
            ...(service.aliases ?? []),
            ...(service.tags ?? []),
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.services.length > 0);

    return groups;
  });

  readonly hasActiveFilters = computed(() => {
    return this.query().trim() !== '' || this.selectedCategory() !== 'all';
  });

  ngAfterViewInit(): void {
    this.loadCatalog();
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTypingTarget =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        !!target.closest('input, textarea, select'));

    if (event.key === '/' && !isTypingTarget) {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    }
  }

  protected loadCatalog(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.http
      .get<CatalogPayload>('assets/catalog/services.json')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (payload) => {
          this.catalog.set(payload);
        },
        error: () => {
          this.errorMessage.set('The service directory could not be loaded. Please refresh the page.');
        },
      });
  }

  protected clearFilters(): void {
    this.query.set('');
    this.selectedCategory.set('all');
    this.searchInput?.nativeElement.focus();
  }

  protected safeUrl(service: CatalogServiceItem): string | null {
    try {
      const parsed = new URL(service.url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return service.url;
      }
    } catch {
      return null;
    }

    return null;
  }

  protected onImageError(serviceId: string): void {
    this.imageFallbacks.update((current) => ({ ...current, [serviceId]: true }));
  }

  protected getServiceImage(service: CatalogServiceItem): string {
    return this.imageFallbacks()[service.id] ? this.fallbackImage : service.image ?? this.fallbackImage;
  }

  protected normalize(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
