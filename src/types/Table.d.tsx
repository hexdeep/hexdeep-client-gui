interface ITableItem {
    label: string;
    width?: string;
    formatter?: (row: any, col: Dictionary<any>, val: any, index: number) => any;
    align?: 'left' | 'center' | 'right';
    showOverflowTooltip?: boolean;
    sortable?: boolean;
    filters?: Array<{ text: string; value: any; }>;
    filterMethod?: (value: any, row: any, col: any) => boolean;
    defaultSlot?: (row: any, col: Dictionary<any>, val: any, index: number) => any;
}