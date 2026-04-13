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
  });

  it('updates command preview when the studio setup changes', async () => {
    const user = userEvent.setup();
    render(<BrunellaStudio />);

    const projectName = screen.getByLabelText('Studio project name');
    await user.clear(projectName);
    await user.type(projectName, 'VV Luxury Drop');
    await user.click(screen.getByTestId('studio-stage-render'));

    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('vv-luxury-drop');
    expect(screen.getByTestId('studio-command-preview')).toHaveTextContent('studio render');
  });

  it('shows the dashboard test command and output locations', async () => {
    const user = userEvent.setup();
    render(<BrunellaStudio />);

    await user.click(screen.getByRole('tab', { name: 'Deliverables' }));
    expect(screen.getByText(/QC artifact/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Tests' }));
    expect(screen.getByTestId('studio-test-command')).toHaveTextContent('BrunellaStudio.test.tsx');
    expect(screen.getByTestId('studio-test-command')).toHaveTextContent('test/studio/e2e.test.ts');
  });
});
