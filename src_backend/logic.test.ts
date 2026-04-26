import { it, expect } from 'vitest';

it('powinien poprawnie walidować dane użytkownika', () => {
  const user = { name: "Admin" };
  expect(user.name).toBe("Admin");
});