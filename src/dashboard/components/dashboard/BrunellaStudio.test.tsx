import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { BrunellaStudio } from './BrunellaStudio';

describe('BrunellaStudio', () => {
  it('renders the new studio pipeline surface with all stages', () => {
    render(<BrunellaStudio />);

    expect(screen.getByTestId('brunella-studio-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Brunella Studio')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-probe')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-ingest')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-rough-cut')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-audio-plan')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-render')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-qc')).toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-review')).toBeInTheDocument();
    expect(screen.getByText('Reviewer signals')).toBeInTheDocument();
    expect(screen.getByText('Music intelligence')).toBeInTheDocument();
  });

  it('updates command preview when the studio setup changes', async () => {
    const user = userEvent.setup();
    render(<BrunellaStudio />);

    const projectName = screen.getByLabelText('Studio project name');
    const callbackUrl = screen.getByLabelText('Studio callback URL');
    await user.clear(projectName);
    await user.type(projectName, 'VV Luxury Drop');
    await user.type(callbackUrl, 'https://example.com/webhooks/studio-review');
    await user.click(screen.getByTestId('studio-stage-render'));

    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('vv-luxury-drop');
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('studio render');

    await user.click(screen.getByTestId('studio-stage-review'));
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('studio review');
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('pipeline-report.json');
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('--callback-url');
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('https://example.com/webhooks/studio-review');
  });

  it('shows the dashboard test command and output locations', async () => {
    const user = userEvent.setup();
    render(<BrunellaStudio />);

    await user.click(screen.getByRole('tab', { name: 'Deliverables' }));
    expect(screen.getByText(/QC artifact/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Tests' }));
    expect(screen.getByTestId('studio-test-command')).toHaveTextContent('BrunellaStudio.test.tsx');
    expect(screen.getByTestId('studio-test-command')).toHaveTextContent('test/studio/review.test.ts');
    expect(screen.getByTestId('studio-test-command')).toHaveTextContent('test/studio/e2e.test.ts');
  });
});
