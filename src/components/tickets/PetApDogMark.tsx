import Image from 'next/image'

interface PetApDogMarkProps {
  className?: string
  title?: string
}

export default function PetApDogMark({ className = 'h-14 w-16', title = 'Perrito PET Ap' }: PetApDogMarkProps) {
  return (
    <Image
      src="/brand/pet-ap-ticket-dog.png"
      width={1035}
      height={961}
      className={`${className} object-contain`}
      alt={title}
      unoptimized
    />
  )
}
