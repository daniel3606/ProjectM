const tintColorLight = '#8B635C';

const Colors = {
    text: '#1C1C1E',
    textSecondary: '#999999',
    background: '#FFF2E5',
    secondary: '#8B635C',
    secondaryLight: '#A87D75',

    gray: '#8E8E93',
    lightGray: '#F2F2F7',

    tint: tintColorLight,
    tabIconDefault: '#C7BDBA',
    tabIconSelected: tintColorLight,

    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
    info: '#5856D6',

    // Calm progress/regress pair for Stats. The system green/red read as alerts
    // next to the warm palette, which is the wrong tone for a trend line.
    positive: '#5C8C6E',
    positiveSoft: '#E7F0E9',
    attention: '#B5766B',
    attentionSoft: '#F6E7E3',

    /** Hairline between sections, lighter than a card border. */
    divider: '#E8DCCC',
    /** Unfilled part of a bar, meter, or chart column. */
    track: '#EFE4D6',

    card: '#FFF5EA',
    cardBorder: '#CCC2B7',
    cardActiveTint: '#FFF8F0',

    white: '#FFFFFF',
} as const;

export default Colors;
