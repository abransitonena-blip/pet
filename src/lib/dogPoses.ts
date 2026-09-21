/** Las posturas del perrito de PET Ap. Ver `components/ui/DogIllustration.tsx`. */
export const DOG_POSES = ['sentado', 'caminando', 'durmiendo', 'asomando', 'olfateando'] as const

export type DogPose = (typeof DOG_POSES)[number]
