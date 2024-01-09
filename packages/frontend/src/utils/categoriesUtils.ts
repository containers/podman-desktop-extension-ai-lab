import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';

import { faAlignLeft, faImages, faQuestion } from '@fortawesome/free-solid-svg-icons';
export const getIcon = (category: string | undefined): IconDefinition | undefined => {
  switch (category) {
    case "natural-language-processing":
      return faAlignLeft;
    case "computer-vision":
      return faImages;
    default:
      return faQuestion;
  }
}
