import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

const themeProviderSpy = vi.fn();

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
    themeProviderSpy(props);
    return <div data-testid="next-themes-provider">{children}</div>;
  },
}));

import { ThemeProvider } from './theme-provider';

describe('ui ThemeProvider', () => {
  it('forwards props to next-themes and renders children', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <span>Dashboard content</span>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('next-themes-provider')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(themeProviderSpy).toHaveBeenCalledWith({
      attribute: 'class',
      defaultTheme: 'dark',
      enableSystem: true,
    });
  });
});
