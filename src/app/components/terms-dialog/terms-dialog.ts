import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-terms-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './terms-dialog.html',
  styleUrl: './terms-dialog.scss',
})
export class TermsDialog {
  shouldBounce = false;

  constructor(
    public dialogRef: MatDialogRef<TermsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; clientName: string }
  ) {}

  onAcknowledge(): void {
    this.dialogRef.close();
  }
}
