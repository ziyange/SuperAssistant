/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Navigation } from '../../src/renderer/navigation.js';

describe('primary navigation', () => {
  test('exposes exactly five destinations and starts at Super Assistant', () => {
    const seen: string[] = [];
    render(<Navigation current="super-assistant" onNavigate={(destination) => seen.push(destination)} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Super Assistant' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Project Center' }));
    expect(seen).toEqual(['project-center']);
    expect(screen.queryByRole('button', { name: /Template/i })).toBeNull();
  });
});
