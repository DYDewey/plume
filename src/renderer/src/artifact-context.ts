import { createContext, useContext } from 'react';
import type { Artifact } from '../../shared/artifacts';

/** Ouvre un artefact dans le panneau de droite ; null : pas de panneau (tests, rendu statique). */
export const ArtifactContext = createContext<((artifact: Artifact) => void) | null>(null);

export const useOpenArtifact = () => useContext(ArtifactContext);
