import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'

describe('sistema visual base', () => {
  test.each(['sm', 'md', 'lg'] as const)('Button %s conserva un target mínimo de 44 px', (size) => {
    render(<Button size={size}>Continuar</Button>)
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveClass('min-h-11')
  })

  test('las variantes críticas usan colores semánticos legibles', () => {
    render(<><Button>Guardar</Button><Button variant="danger">Eliminar</Button></>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('bg-primary', 'text-white')
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('bg-danger', 'text-white')
  })

  test('Input conserva altura táctil y estado disabled diferenciable', () => {
    render(<Input aria-label="Teléfono" disabled />)
    expect(screen.getByLabelText('Teléfono')).toHaveClass('min-h-11', 'disabled:bg-ink/[0.04]')
  })

  test('Card solo aplica elevación interactiva cuando se solicita', () => {
    const { rerender } = render(<Card data-testid="card">Resumen</Card>)
    expect(screen.getByTestId('card')).not.toHaveClass('hover:-translate-y-px')
    rerender(<Card data-testid="card" interactive>Seleccionar</Card>)
    expect(screen.getByTestId('card')).toHaveClass('hover:-translate-y-px')
  })

  test('ConfirmDialog enfoca cancelar y permite cerrar con Escape', () => {
    const onCancel = jest.fn()
    render(<ConfirmDialog open title="Confirmar" onConfirm={jest.fn()} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
