import { Component, Prop, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import * as QRCode from 'qrcode';

@Component
export class QrCode extends tsx.Component<IPorps> {
    private imgData = '';
    @Prop() private qrData!: string;
    @Prop({ default: 120 }) size!: number;
    @Prop({ default: 2 }) margin!: number;
    @Prop({ default: 5 }) radius!: number;

    constructor() {
        super();
        console.log(this.qrData);
    }

    @Watch("qrData")
    protected created() {
        console.log(this.qrData);
        QRCode.toDataURL(this.qrData, {
            width: this.size,
            margin: this.margin,
        }, (error: any, url) => {
            if (error) console.error(error);
            else
                this.imgData = url;
        });
    }

    protected render() {
        return (
            <img src={this.imgData} width={this.size} height={this.size} style={{ borderRadius: `${this.radius}px` }} />
        );
    }
}

interface IPorps {
    qrData: string;
    /**默认120px */
    size?: number;
    /**默认2px */
    margin?: number;
    /**默认5px */
    radius?: number;
}