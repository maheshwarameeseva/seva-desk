import { Component } from '@angular/core';
import { EmployeeWorkspaceComponent } from './features/employee-workspace/employee-workspace.component';

@Component({
  selector: 'app-root',
  imports: [EmployeeWorkspaceComponent],
  template: '<app-employee-workspace></app-employee-workspace>',
  styleUrl: './app.scss',
})
export class App {}
