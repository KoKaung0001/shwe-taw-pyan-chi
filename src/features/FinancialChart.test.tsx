import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { buildFinancialChartSeries } from '../domain/reporting';
import { FinancialChart } from './FinancialChart';

it('keeps long-range lines clear while showing a marker for the inspected date', () => {
  const values = buildFinancialChartSeries([], { startDate: '2026-04-24', endDate: '2026-10-23' });
  const { container } = render(<FinancialChart values={values} view="net_change" onViewChange={() => {}} />);
  expect(container.querySelectorAll('.financial-chart-net-change-point')).toHaveLength(0);
  expect(container.querySelector('.financial-chart-net-change-line')).toBeInTheDocument();
  fireEvent.focus(container.querySelector('.financial-chart-date-point')!);
  expect(container.querySelectorAll('.financial-chart-net-change-point')).toHaveLength(1);
  expect(container.querySelector('.financial-chart-net-change-point')).toHaveClass('is-selected');
});
