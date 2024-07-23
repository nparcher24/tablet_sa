import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
      <mat-form-field>
        <input matInput placeholder="Email" formControlName="email">
      </mat-form-field>
      <mat-form-field>
        <input matInput type="password" placeholder="Password" formControlName="password">
      </mat-form-field>
      <button mat-raised-button color="primary" type="submit">Login</button>
    </form>
  `,
  styles: [`
    form { display: flex; flex-direction: column; align-items: center; margin-top: 20px; }
    mat-form-field { width: 300px; margin-bottom: 10px; }
  `]
})
export class LoginComponent {
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private auth: AngularFireAuth,
    private router: Router
  ) {}

  async onSubmit() {
    if (this.loginForm.valid) {
      try {
        await this.auth.signInWithEmailAndPassword(
          this.loginForm.value.email!,
          this.loginForm.value.password!
        );
        this.router.navigate(['/map']);
      } catch (error) {
        console.error('Login failed', error);
      }
    }
  }
}