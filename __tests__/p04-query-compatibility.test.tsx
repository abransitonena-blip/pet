import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
}))

jest.mock('@/lib/defaultConfig', () => ({
  getDayOfWeek: () => 'lun',
  generateTimeSlots: () => ['09:00', '10:00'],
}))

import AvailabilityCalendar from '../src/components/AvailabilityCalendar'

describe('P0.4 query compatibility', () => {
  it('does not infer public availability from the private legacy reservations collection', () => {
    const onSelect = jest.fn()
    render(<AvailabilityCalendar date="2026-08-10" onSelect={onSelect} />)

    expect(screen.getByText(/La disponibilidad se confirma al revisar tu solicitud/i)).toBeInTheDocument()
    expect(screen.queryByText(/horarios disponibles/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '09:00' }))
    expect(onSelect).toHaveBeenCalledWith('09:00')
  })
})
