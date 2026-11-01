import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EmptyStateComponent, PageHeaderComponent } from '../../../shared/components';
import { NotifyService } from '../../../shared/services';
import { SummaryService } from '../../../core/services/summary.service';
import { downloadTextFile, parseCsv } from '../shared/csv.util';

type ExportState = 'idle' | 'requesting' | 'polling' | 'success' | 'failure' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // ~30 seconds

@Component({
  selector: 'app-results',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss',
})
export class ResultsComponent implements OnDestroy {
  private readonly summaryService = inject(SummaryService);
  private readonly notify = inject(NotifyService);

  readonly state = signal<ExportState>('idle');
  readonly errorMessage = signal<string | null>(null);

  readonly header = signal<string[]>([]);
  readonly dataRows = signal<string[][]>([]);
  private rawCsv: string | null = null;

  readonly hasResults = computed(() => this.state() === 'success' && this.dataRows().length > 0);
  readonly isBusy = computed(() => this.state() === 'requesting' || this.state() === 'polling');

  private pollTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private pollAttempts = 0;

  ngOnDestroy(): void {
    this.clearPoll();
  }

  requestExport(): void {
    this.clearPoll();
    this.state.set('requesting');
    this.errorMessage.set(null);

    this.summaryService.requestExport().subscribe({
      next: (taskId) => {
        this.pollAttempts = 0;
        this.state.set('polling');
        this.poll(taskId);
      },
      error: (err) => {
        this.state.set('failure');
        this.errorMessage.set('Failed to start the export job.');
        this.notify.errorFrom(err, 'Failed to start the export job.');
      },
    });
  }

  private poll(taskId: string): void {
    this.summaryService.checkExportStatus(taskId).subscribe({
      next: (result) => {
        if (result.state === 'SUCCESS') {
          this.handleSuccess(result.csv ?? '');
          return;
        }

        if (result.state === 'FAILURE') {
          this.state.set('failure');
          this.errorMessage.set(result.status ?? 'The export job failed.');
          this.notify.error(this.errorMessage() ?? 'The export job failed.');
          return;
        }

        // PENDING (or any other in-progress state) - keep polling until the cap.
        this.pollAttempts++;
        if (this.pollAttempts >= MAX_POLL_ATTEMPTS) {
          this.state.set('timeout');
          return;
        }

        this.pollTimeoutHandle = setTimeout(() => this.poll(taskId), POLL_INTERVAL_MS);
      },
      error: (err) => {
        this.state.set('failure');
        this.errorMessage.set('Failed to check the export status.');
        this.notify.errorFrom(err, 'Failed to check the export status.');
      },
    });
  }

  private handleSuccess(csv: string): void {
    this.rawCsv = csv;
    const rows = parseCsv(csv);
    this.header.set(rows[0] ?? []);
    this.dataRows.set(rows.slice(1));
    this.state.set('success');
    this.notify.success('Your results export is ready.');
  }

  download(): void {
    if (!this.rawCsv) return;
    downloadTextFile(this.rawCsv, `my-results-${Date.now()}.csv`);
  }

  private clearPoll(): void {
    if (this.pollTimeoutHandle !== null) {
      clearTimeout(this.pollTimeoutHandle);
      this.pollTimeoutHandle = null;
    }
  }
}
