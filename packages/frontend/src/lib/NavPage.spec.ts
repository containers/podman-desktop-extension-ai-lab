import '@testing-library/jest-dom/vitest';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NavPage from '/@/lib/NavPage.svelte';

test('NavPage should have linear progress', async () => {
  // render the component
  render(NavPage, {loading: true, title: 'dummy'});

  const content = await screen.findByLabelText('content');
  expect(content).toBeDefined();
  expect(content.firstChild?.nodeName).toBe('PROGRESS');
});

test('NavPage should not have linear progress', async () => {
  // render the component
  render(NavPage, {title: 'dummy'});

  const content = await screen.findByLabelText('content');
  expect(content).toBeDefined();
  expect(content.firstChild).toBeNull(); // no slot content provided
});
