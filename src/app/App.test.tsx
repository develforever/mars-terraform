import { render, screen, waitFor } from '@testing-library/react';
import { it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import './i18n';
import App from './App';

it('powinien wyrenderować nagłówek', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByTestId('app')).toBeTruthy();
  });
});