import { Component, Prop } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import './tree.less';

/**
 * 自定义树组件
 * 目前仅支持两层
 * 多层需重新计算高度及选中状态
 */
@Component
export class MyTree extends tsx.Component<IProps, {}, ISlots> {
    @Prop() private data!: ITreeData[];
    @Prop() private showCheckbox?: boolean;

    protected render() {
        return <div class="mytree">
            {this.renderData(this.data)}
        </div>;
    }

    private toggleExpand(item: ITreeData) {
        item.opened = !item.opened;
    }

    private renderData(data: ITreeData[], level: number = 0) {
        return data.map(item => {
            const height = item.opened ? (item.children?.length ?? 0) * 26 + 26 : 26;
            const allSelected = item.children ? item.children.every(child => child.selected) : item.selected;
            const indeterminate = item.children ? item.children.some(child => child.selected) && !allSelected : false;
            const handleInput = (val: boolean) => {
                console.log("handleInput", item, val);
                item.selected = val;
                if (item.children) {
                    item.children.forEach(child => {
                        child.selected = val;
                    });
                }
            };
            return <div class="mytree-item" style={{ height: `${height}px`, paddingLeft: `${level * 20}px` }}>
                <div class="mytree-item-content">
                    {item.children && item.children.length > 0 && <i class={["el-icon-caret-right mytree-expand-icon", item.opened && "opened"]} onClick={() => this.toggleExpand(item)} />}
                    {this.showCheckbox && <el-checkbox value={allSelected} indeterminate={indeterminate} onInput={handleInput} />}
                    {this.renderContent(item)}
                </div>
                {item.children && item.children.length > 0 && <div class="mytree-item-children">
                    {this.renderData(item.children, level + 1)}
                </div>}
            </div>;
        });
    }

    private renderContent(item: ITreeData) {
        const content = this.$scopedSlots.renderContent;
        if (content) {
            return content(item);
        } else {
            return (
                <div class="mytree-item-content-label">
                    {item.label}
                </div>
            );
        }
    }
}

interface IProps {
    data: ITreeData[];
    showCheckbox?: boolean;
}

export interface ITreeData {
    key: string;
    label: string;
    opened: boolean;
    selected: boolean;
    children?: ITreeData[];
}

interface ISlots {
    renderContent: ITreeData;
}