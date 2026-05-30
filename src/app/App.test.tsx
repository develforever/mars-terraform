import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import './i18n';
import App from './App';

it('powinien wyrenderować nagłówek', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByTestId('app')).toBeTruthy();
});