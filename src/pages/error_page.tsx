import { Component, Prop } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';

@Component
export class ErrorPage extends tsx.Component<IPorps, {}, ISlots> {
    @Prop() private error!: any;
    protected render() {
        return (
            <div style={"display: flex;justify-content: center;align-items: center;font-size: 40px;color:red;"}>
                {this.$scopedSlots.default ? this.$scopedSlots.default() : this.error?.toString()}
            </div>
        );
    }
}

export default ErrorPage;

interface IPorps {
    error?: any;
}
interface ISlots {
    default: void;
}