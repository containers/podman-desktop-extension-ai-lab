import path from 'path';

export function getParentDirectory(filePath: string): string {
  // Normalize the path to handle different platform-specific separators
  const normalizedPath = path.normalize(filePath);

  // Get the directory name using path.dirname
  return path.dirname(normalizedPath);
}
