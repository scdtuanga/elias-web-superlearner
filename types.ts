import type React from 'react';

export interface LearningSkill {
  title: string;
  description: string;
  // FIX: Made the icon type more specific to SVG elements to allow cloning with a className prop.
  icon: React.ReactElement<React.SVGProps<SVGSVGElement>>;
}
