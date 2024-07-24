import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BullseyeDialogComponent } from './bullseye-dialog.component';
import { BullseyeService } from '../../services/bullseye.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" class="settings-button">
      <mat-icon>settings</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="openBullseyeDialog()">Set Bullseye</button>
    </mat-menu>
  `,
  styles: [`
    :host {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
    }
    .settings-button {
      color: #CCCCCC;
    }
  `]
})
export class SettingsMenuComponent {
  constructor(private dialog: MatDialog, private bullseyeService: BullseyeService) { }

  openBullseyeDialog() {
    const dialogRef = this.dialog.open(BullseyeDialogComponent, {
      width: '350px',
    });

    dialogRef.componentInstance.bullseyeUpdated.subscribe(() => {
      this.bullseyeService.notifyBullseyeUpdated();
    });
  }
}