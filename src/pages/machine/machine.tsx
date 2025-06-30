import { Column, Row } from "@/lib/container";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import s from './machine.module.less';
import { TextButton } from "@/lib/my_button";
import { deviceApi } from "@/api/device_api";
import { HostInfo } from "@/api/device_define";

@Component
export default class MachinePage extends Vue {
    private data: HostInfo[] = [];

    protected async created() {
        this.data = await deviceApi.getHosts();
    }
    protected render() {
        return (
            <div style={{ flex: 1 }}>
                <Column gap={20} class={["contentBox", s.Machine]}>
                    <Column flex class={"fixTable"}>
                        <el-table data={this.data} width="100%" height="100%">
                            <el-table-column prop="deviceId" label="ID" />
                            <el-table-column prop="address" label="主机" />
                            <el-table-column prop="vmNums" label="虚拟机" width="100" />
                            <el-table-column label="操作" width="60" formatter={this.renderAction} />
                        </el-table>
                    </Column>
                </Column>
            </div>
        );
    }

    private renderAction(row: any) {
        return (
            <Row gap={8}>
                <TextButton text="详情" />
            </Row>
        );
    }
}