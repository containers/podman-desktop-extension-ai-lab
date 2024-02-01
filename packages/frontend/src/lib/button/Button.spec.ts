import '@testing-library/jest-dom/vitest';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Button from '/@/lib/button/Button.svelte';

test('Button inProgress must have a spinner', async () => {
  // render the component
  render(Button, { inProgress: true });

  const svg = screen.getByRole('img');
  expect(svg).toBeDefined();
});

test('Button no progress no icon do not have spinner', async () => {
  // render the component
  render(Button, { inProgress: false });

  const svg = screen.queryByRole('img');
  expect(svg).toBeNull();
});
