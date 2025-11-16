import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './privacy-dialog.html',
  styleUrl: './privacy-dialog.scss',
})
export class PrivacyDialog {
  shouldBounce = false;

  constructor(
    public dialogRef: MatDialogRef<PrivacyDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; clientName: string }
  ) {}

  onAcknowledge(): void {
    this.dialogRef.close();
  }
}
