const GITHUB_PREFIX = "https://github.com/";

export const getDisplayName = (link: string | undefined): string => {
  if(link === undefined)
    return "?";

  if(link.startsWith(GITHUB_PREFIX))
    return link.substring(GITHUB_PREFIX.length)

  return link;
}
