import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setThemeMock = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an accessible theme toggle trigger', () => {
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Toggle theme');
  });

  it('opens the menu and forwards the selected theme to next-themes', async () => {
    render(<ThemeToggle />);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Light' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Dark' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'System' }));

    expect(setThemeMock).toHaveBeenNthCalledWith(1, 'light');
    expect(setThemeMock).toHaveBeenNthCalledWith(2, 'dark');
    expect(setThemeMock).toHaveBeenNthCalledWith(3, 'system');
  });
});
