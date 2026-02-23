import { render, screen, fireEvent, act } from '@testing-library/react';
import ColorMenu from './ColorMenu';

const COLORS_HEX = [
  '#4a9eff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

// jsdom converts hex to rgb in style properties
const COLORS_RGB = [
  'rgb(74, 158, 255)', 'rgb(34, 197, 94)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)', 'rgb(168, 85, 247)',
  'rgb(236, 72, 153)', 'rgb(6, 182, 212)', 'rgb(249, 115, 22)', 'rgb(132, 204, 22)', 'rgb(99, 102, 241)',
];

function renderMenu(overrides: Partial<React.ComponentProps<typeof ColorMenu>> = {}) {
  const props = {
    x: 100,
    y: 200,
    onSelect: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const result = render(<ColorMenu {...props} />);
  return { ...result, props };
}

describe('ColorMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all 10 color swatches', () => {
    renderMenu();
    const swatches = screen.getAllByRole('button').filter((btn) =>
      btn.classList.contains('color-swatch')
    );
    expect(swatches).toHaveLength(10);
  });

  it('each swatch has the correct background color', () => {
    renderMenu();
    const swatches = screen.getAllByRole('button').filter((btn) =>
      btn.classList.contains('color-swatch')
    );
    swatches.forEach((swatch, i) => {
      expect(swatch.style.backgroundColor).toBe(COLORS_RGB[i]);
    });
  });

  it('clicking a swatch calls onSelect with the correct hex', () => {
    const { props } = renderMenu();
    const swatches = screen.getAllByRole('button').filter((btn) =>
      btn.classList.contains('color-swatch')
    );
    fireEvent.click(swatches[3]); // red
    expect(props.onSelect).toHaveBeenCalledWith(COLORS_HEX[3]);
  });

  it('clicking Duplicate calls onDuplicate', () => {
    const { props } = renderMenu();
    fireEvent.click(screen.getByText('Duplicate'));
    expect(props.onDuplicate).toHaveBeenCalledOnce();
  });

  it('clicking Delete calls onDelete', () => {
    const { props } = renderMenu();
    fireEvent.click(screen.getByText('Delete'));
    expect(props.onDelete).toHaveBeenCalledOnce();
  });

  it('does not render Send to Today when onSendToToday is not provided', () => {
    renderMenu();
    expect(screen.queryByText('Send to Today')).not.toBeInTheDocument();
  });

  it('renders Send to Today when onSendToToday is provided', () => {
    const onSendToToday = vi.fn();
    renderMenu({ onSendToToday });
    const btn = screen.getByText('Send to Today');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onSendToToday).toHaveBeenCalledOnce();
  });

  it('click-outside triggers onClose after setTimeout(0)', () => {
    const { props } = renderMenu();
    // The mousedown listener is added after setTimeout(0)
    act(() => { vi.advanceTimersByTime(1); });
    // Simulate click outside
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
