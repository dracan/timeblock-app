import { render, screen, fireEvent } from '@testing-library/react';
import TimeBlock from './TimeBlock';
import { makeEntry } from '../../test/helpers';
import { minutesToPixels, DEFAULT_HOUR_HEIGHT } from '../utils/time';

function renderBlock(overrides: Partial<React.ComponentProps<typeof TimeBlock>> = {}) {
  const entry = overrides.entry ?? makeEntry({ title: 'Test Block', startMinutes: 540, endMinutes: 600 });
  const props = {
    entry,
    hourHeight: DEFAULT_HOUR_HEIGHT,
    isSelected: false,
    isEditing: false,
    columnIndex: 0,
    totalColumns: 1,
    onMouseDown: vi.fn(),
    onResizeStart: vi.fn(),
    onContextMenu: vi.fn(),
    onTitleChange: vi.fn(),
    onTitleBlur: vi.fn(),
    onTitleDoubleClick: vi.fn(),
    onToggleDone: vi.fn(),
    ...overrides,
  };
  const result = render(<TimeBlock {...props} />);
  return { ...result, props };
}

describe('TimeBlock', () => {
  it('renders the entry title', () => {
    renderBlock({ entry: makeEntry({ title: 'Morning standup' }) });
    expect(screen.getByText('Morning standup')).toBeInTheDocument();
  });

  it('renders the time range and duration', () => {
    renderBlock({
      entry: makeEntry({ startMinutes: 540, endMinutes: 600 }),
    });
    // formatTime(540) = "9:00 AM", formatTime(600) = "10:00 AM", formatDuration(60) = "1h"
    expect(screen.getByText('9:00 AM - 10:00 AM (1h)')).toBeInTheDocument();
  });

  it('is positioned correctly based on minutesToPixels', () => {
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const { container } = renderBlock({ entry });
    const block = container.firstChild as HTMLElement;
    const expectedTop = minutesToPixels(540, DEFAULT_HOUR_HEIGHT);
    const expectedHeight = minutesToPixels(600, DEFAULT_HOUR_HEIGHT) - expectedTop;
    expect(block.style.top).toBe(`${expectedTop}px`);
    expect(block.style.height).toBe(`${expectedHeight}px`);
  });

  it('applies column layout for overlapping entries', () => {
    const entry = makeEntry();
    const { container } = renderBlock({ entry, columnIndex: 1, totalColumns: 3 });
    const block = container.firstChild as HTMLElement;
    // left = (1/3)*100 = 33.3333%
    expect(block.style.left).toContain('33.3333');
    // width = calc(33.3333% - 1px)
    expect(block.style.width).toContain('33.3333');
  });

  it('has selected class when isSelected is true', () => {
    const { container } = renderBlock({ isSelected: true });
    const block = container.firstChild as HTMLElement;
    expect(block.classList.contains('selected')).toBe(true);
  });

  it('does not have selected class when isSelected is false', () => {
    const { container } = renderBlock({ isSelected: false });
    const block = container.firstChild as HTMLElement;
    expect(block.classList.contains('selected')).toBe(false);
  });

  it('has done class when entry.done is true', () => {
    const entry = makeEntry({ done: true });
    const { container } = renderBlock({ entry });
    const block = container.firstChild as HTMLElement;
    expect(block.classList.contains('done')).toBe(true);
  });

  it('hides time details in compact mode (very short block)', () => {
    // With default hourHeight=60, compact threshold is height <= 20
    // 20px at 60px/hr = 20 minutes. So a 15-min block should be compact.
    const entry = makeEntry({ startMinutes: 540, endMinutes: 555 });
    renderBlock({ entry });
    expect(screen.queryByText(/AM.*-.*AM/)).not.toBeInTheDocument();
  });

  it('double-click on title fires onTitleDoubleClick', () => {
    const { props } = renderBlock({ entry: makeEntry({ title: 'Click me' }) });
    fireEvent.doubleClick(screen.getByText('Click me'));
    expect(props.onTitleDoubleClick).toHaveBeenCalledOnce();
  });

  it('shows input when isEditing and fires onTitleBlur on Enter', () => {
    const entry = makeEntry({ title: 'Editing' });
    const { props } = renderBlock({ entry, isEditing: true });
    const input = screen.getByDisplayValue('Editing');
    expect(input).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onTitleBlur).toHaveBeenCalledOnce();
  });

  it('fires onTitleBlur on Escape key', () => {
    const entry = makeEntry({ title: 'Editing' });
    const { props } = renderBlock({ entry, isEditing: true });
    const input = screen.getByDisplayValue('Editing');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onTitleBlur).toHaveBeenCalledOnce();
  });

  it('checkbox click fires onToggleDone without propagation', () => {
    const { props, container } = renderBlock();
    const checkbox = container.querySelector('.time-block-checkbox')!;
    fireEvent.click(checkbox);
    expect(props.onToggleDone).toHaveBeenCalledOnce();
    // onMouseDown should NOT have been called (event didn't propagate)
    expect(props.onMouseDown).not.toHaveBeenCalled();
  });

  it('resize handle mousedown fires onResizeStart with correct edge', () => {
    const { props, container } = renderBlock();
    const topHandle = container.querySelector('.resize-handle-top')!;
    const bottomHandle = container.querySelector('.resize-handle-bottom')!;
    fireEvent.mouseDown(topHandle);
    expect(props.onResizeStart).toHaveBeenCalledWith(expect.anything(), 'top');
    fireEvent.mouseDown(bottomHandle);
    expect(props.onResizeStart).toHaveBeenCalledWith(expect.anything(), 'bottom');
  });
});
