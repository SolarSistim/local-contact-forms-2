import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ada-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './ada-dialog.html',
  styleUrl: './ada-dialog.scss',
})
export class AdaDialog {
  shouldBounce = false;

  constructor(
    public dialogRef: MatDialogRef<AdaDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; clientName: string }
  ) {}

  onAcknowledge(): void {
    this.dialogRef.close();
  }
}
