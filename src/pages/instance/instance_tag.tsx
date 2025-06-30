import { Row } from '@/lib/container';
import { Component, Prop } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';

@Component
export class InstanceTag extends tsx.Component<IProps> {
    @Prop() text!: string;
    @Prop() value!: string;

    private get tagStyle() {
        const color = InstanceTag.getColor(this.value);
        return {
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: color
        };
    }

    public static getColor(str: string) {
        switch (str) {
            case "无实例": return "#409eff";
            case "正常": return "#67c23a";
            case "即将到期": return "#e6a23c";
            case "已过期": return "#f56c6c";
            default: return "#409eff";
        }
    }

    protected render() {
        return (
            <Row gap={5} crossAlign="center">
                <div style={this.tagStyle} />
                <div>{this.text}</div>
            </Row>
        );
    }
}

interface IProps {
    text: string;
    value: string;
}
