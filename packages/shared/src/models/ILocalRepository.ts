export interface LocalRepository {
  // recipeFolder
  path: string;
  // recipeFolder + basedir
  sourcePath: string;
  labels: { [id: string]: string };
}
