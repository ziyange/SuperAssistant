export function projectRegistrationError(error: unknown): string {
  void error;
  return 'Project path could not be validated.';
}
