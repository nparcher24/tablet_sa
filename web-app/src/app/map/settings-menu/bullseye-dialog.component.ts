import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bullseye-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatInputModule, 
    MatSelectModule, 
    MatFormFieldModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>Set Bullseye Position</h2>
    <mat-dialog-content>
      <div class="form-container">
        <mat-form-field appearance="fill">
          <mat-label>Format</mat-label>
          <mat-select [(ngModel)]="format">
            <mat-option value="DD MM.mmmm">DD MM.mmmm</mat-option>
            <mat-option value="DD MM SSS.sss">DD MM SSS.sss</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="coordinate-input">
          <mat-form-field appearance="fill" class="direction-select">
            <mat-select [(ngModel)]="latDirection">
              <mat-option value="N">N</mat-option>
              <mat-option value="S">S</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="fill" class="coordinate-field">
            <mat-label>Latitude</mat-label>
            <input matInput [(ngModel)]="latitude" placeholder="e.g., 40 44.5678">
          </mat-form-field>
        </div>
        <div class="coordinate-input">
          <mat-form-field appearance="fill" class="direction-select">
            <mat-select [(ngModel)]="lonDirection">
              <mat-option value="E">E</mat-option>
              <mat-option value="W">W</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="fill" class="coordinate-field">
            <mat-label>Longitude</mat-label>
            <input matInput [(ngModel)]="longitude" placeholder="e.g., 073 59.1234">
          </mat-form-field>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="saveBullseye()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    .coordinate-input {
      display: flex;
      gap: 8px;
    }
    .direction-select {
      width: 70px;
    }
    .coordinate-field {
      flex-grow: 1;
    }
  `]
})
export class BullseyeDialogComponent implements OnInit {
  format = 'DD MM.mmmm';
  latitude = '';
  longitude = '';
  latDirection = 'N';
  lonDirection = 'W';

  constructor(private dialogRef: MatDialogRef<BullseyeDialogComponent>) {}

  @Output() bullseyeUpdated = new EventEmitter<void>();


  ngOnInit() {
    // Load saved values
    this.format = localStorage.getItem('bullseyeFormat') || 'DD MM.mmmm';
    this.latDirection = localStorage.getItem('bullseyeLatDirection') || 'N';
    this.lonDirection = localStorage.getItem('bullseyeLonDirection') || 'W';
    this.latitude = localStorage.getItem('bullseyeLatitude') || '';
    this.longitude = localStorage.getItem('bullseyeLongitude') || '';
  }

  saveBullseye() {
    localStorage.setItem('bullseyeFormat', this.format);
    localStorage.setItem('bullseyeLatDirection', this.latDirection);
    localStorage.setItem('bullseyeLonDirection', this.lonDirection);
    localStorage.setItem('bullseyeLatitude', this.latitude);
    localStorage.setItem('bullseyeLongitude', this.longitude);
    this.bullseyeUpdated.emit();
    this.dialogRef.close();
  }
}