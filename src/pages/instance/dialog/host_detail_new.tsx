import { deviceApi } from "@/api/device_api";
import { HostDetailInfo, HostInfo, SDKImagesRes } from "@/api/device_define";
import { Tools, timeDiff } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { Row } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { SwitchSDKDialog } from "./switch_sdk";
import { SwitchDiskDialog } from "./switch_disk";
import { CleanGarbageDialog } from "./clean_garbage_dialog";
import { SetSwapDialog } from "./set_swap";
import { DiscoverDialog } from "@/pages/vm/dialog/discover";
import { VipHostSelectDialog } from "@/pages/vm/dialog/vip_host_select";
import { orderApi } from "@/api/order_api";
import { DeviceVipInfo } from "@/api/order_define";
import { SwitchFirmwareDialog } from "./switch_firmware";

@Dialog
export class HostDetailDialog extends CommonDialog<HostInfo, void> {
    protected detail: HostDetailInfo = {} as HostDetailInfo;
    protected sdk?: SDKImagesRes;
    protected model: string = "";
    protected isOfficialModel: boolean = true;
    protected timer: any;
    protected vipInfo?: DeviceVipInfo;
    protected vipExpired: boolean = true;
    override width: string = "600px";
    public override async show(data: HostInfo) {
        this.data = data;
        this.title = this.$t("instance.hostDetail").toString();
        deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        deviceApi.getWarehousingInfo(data.address).then(e => {
            if (e.code !== 200) {
                this.isOfficialModel = false;
                this.model = this.$t("vmDetail.queryModelError").toString();
            } else if (e.data.model === "非官方设备") {
                this.isOfficialModel = false;
                this.model = e.data.model;
            } else {
                this.isOfficialModel = true;
                this.model = e.data.model;
            }
        }).catch(e => console.log(e));
        deviceApi.getSDKImages(data.address).then(e => this.sdk = e);
        // 获取VIP信息
        this.loadVipInfo();
        this.timer = setInterval(() => {
            deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        }, 1000);
        return super.show(data);
    }

    private async loadVipInfo() {
        try {
            const vipInfos = await orderApi.getDeviceVip(this.data.device_id);
            if (vipInfos && vipInfos.length > 0) {
                this.vipInfo = vipInfos[0];
                this.vipExpired = timeDiff(this.vipInfo.rental_end_time, this.vipInfo.current_time, "second") <= 0;
            } else {
                this.vipExpired = true;
            }
        } catch (e) {
            console.warn(e);
            this.vipExpired = true;
        }
    }

    protected destroyed() {
        clearInterval(this.timer);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderDialog(): VNode {
        return (
            <el-descriptions size="medium" column={1} border labelStyle={{ "width": "100px" }} style={{ padding: "20px" }}>
                <el-descriptions-item label={i18n.t("vmDetail.sdkVersion")}>
                    <Row crossAlign="center" class="flex gap-4">
                        <el-tooltip
                          effect="dark"
                          content={this.sdk?.current_version}
                          placement="top"
                          disabled={this.sdk?.current_version && this.sdk.current_version.length <= 20}
                        >
                          <div class="w-64 truncate">{this.sdk?.current_version}</div>
                        </el-tooltip>
                        <Row gap={10} class="shrink-0 ms-auto">
                            <MyButton type="primary" size="small" onClick={this.rebootSDK}>
                              {this.$t("vmDetail.rebootSDK")}
                            </MyButton>
                            <MyButton type="primary" size="small" onClick={this.switchSDK}>
                              {this.$t("instance.switchSDK")}
                            </MyButton>
                        </Row>
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.apiGitCommitId")}>
                    <Row crossAlign="center">
                        <div style={{ "flex": 1 }}>{this.detail?.git_commit_id}/{this.sdk?.git_commit_id}</div>
                        <a
                            href="https://docs.hexdeep.com/h1/firmware.html"
                            target="_blank"
                            class="hover:underline"
                            style={{ marginRight: "10px", color: "#409EFF" }}
                        >
                            获取线刷包
                        </a>
                        <MyButton
                            type="primary"
                            size="small"
                            onClick={this.switchFirmware}
                        >
                            {this.$t("vmDetail.switchFirmware")}
                        </MyButton>
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("create.model_id")}>
                    <Row crossAlign="center" mainAlign="space-between">
                        <span style={{ color: this.isOfficialModel ? "inherit" : "red" }}>
                            {this.model ? `${this.model}(${this.data.address})` : this.data.address}
                        </span>
                        {!this.vipExpired && this.vipInfo && (
                            <Row crossAlign="center" gap={10}>
                                <span style={{ color: "green", fontSize: "12px" }}>
                                    {this.$t("vip.expireTime")}: {this.vipInfo.rental_end_time}
                                </span>
                                <MyButton type="primary" size="small" onClick={this.onRenewVip}>
                                    {this.$t("vip.renew")}
                                </MyButton>
                            </Row>
                        )}
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.id")}>
                    {this.data.device_id}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.cpu")}>
                    <el-progress text-inside={true} percentage={this.getPercent(this.detail?.cpu)} stroke-width={26}
                        status={this.getStatus(this.detail?.cpu)}></el-progress>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("create.memory")}>
                    <div style={{ marginBottom: "10px" }}>
                        <el-progress
                            text-inside={true}
                            percentage={this.getPercent(this.detail?.mem_percent)}
                            stroke-width={26}
                            status={this.getStatus(this.detail?.mem_percent)}
                        ></el-progress>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                            <span>{this.$t("vmDetail.mem")}</span>
                            <span>{Tools.getFileSize((this.detail?.mem_total || 0) * this.getPercent(this.detail?.mem_percent) / 100)} / {Tools.getFileSize(this.detail?.mem_total || 0)}</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <el-progress
                                text-inside={true}
                                percentage={this.getPercent(this.detail?.swap_percent)}
                                stroke-width={26}
                                status={this.getStatus(this.detail?.swap_percent)}
                            ></el-progress>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <span>{this.$t("vmDetail.swap")}</span>
                                    <el-tooltip effect="dark" content={i18n.t("vmDetail.virtualMemTip")} placement="top">
                                        <i class="el-icon-info" style="margin-left: 4px; cursor: pointer;"></i>
                                    </el-tooltip>
                                </div>
                                <span>{Tools.getFileSize((this.detail?.swap_total || 0) * this.getPercent(this.detail?.swap_percent) / 100)} / {Tools.getFileSize(this.detail?.swap_total || 0)}</span>
                            </div>
                        </div>
                        <div style={{ width: "100px", marginLeft: "10px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                            <MyButton
                                type="primary"
                                size="small"
                                style={{ whiteSpace: "nowrap" }}
                                onClick={this.setSwap}
                            >
                                {this.$t("vmDetail.set")}
                            </MyButton>
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.harddisk") + (this.detail.disk ? "(" + this.detail.disk + ")" : "")}>
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <el-progress text-inside={true} percentage={this.getPercent(this.detail?.disk_percent)}
                                stroke-width={26} status={this.getStatus(this.detail?.disk_percent)}></el-progress>
                            <div style={{ "text-align": "right" }}>
                                {Tools.getFileSize((this.detail?.disk_total || 0) * this.getPercent(this.detail?.disk_percent) / 100)} / {Tools.getFileSize(this.detail?.disk_total || 0)}
                            </div>
                        </div>
                        <div style={{ marginLeft: "10px", display: "flex", gap: "10px" }}>
                            <MyButton
                                type="primary"
                                size="small"
                                style={{ whiteSpace: "nowrap" }}
                                onClick={this.switchDisk}
                            >
                                {this.$t("vmDetail.switchDisk")}
                            </MyButton>
                            <MyButton
                                type="primary"
                                size="small"
                                style={{ whiteSpace: "nowrap" }}
                                onClick={this.cleanupGarbage}
                            >
                                {this.$t("vmDetail.cleanupGarbage")}
                            </MyButton>
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.temperature")}>
                    {this.detail?.temperature} ℃
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.hostOperate")}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",      // ✅ 允许自动换行
                            gap: "10px 10px",      // 行间距 + 列间距
                            alignItems: "center",
                        }}
                    >
                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}   // ❗按钮内不换行
                            onClick={this.rebootHost}
                        >
                            {this.$t("vmDetail.rebootHost")}
                        </MyButton>

                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.resetHost}
                        >
                            {this.$t("vmDetail.resetHost")}
                        </MyButton>

                        <MyButton
                            type="primary"
                            size="small"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={this.showDiscover}
                        >
                            {this.$t("discover.title")}
                        </MyButton>
                    </div>
                </el-descriptions-item>
            </el-descriptions>
        );
    }

    @ErrorProxy({ success: i18n.t("vmDetail.rebootSDKSuccess"), loading: i18n.t("loading") })
    private async rebootSDK() {
        await deviceApi.rebootSDK(this.data.address);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.rebootHostConfirm"), success: i18n.t("vmDetail.rebootHostSuccess"), loading: i18n.t("loading") })
    private async rebootHost() {
        await deviceApi.rebootHost(this.data.address);
    }



    private async switchDisk() {
        await this.$dialog(SwitchDiskDialog).show(this.data);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.cleanGarbageConfirm") })
    private async cleanupGarbage() {
        await this.$dialog(CleanGarbageDialog).show(this.data);
    }

    private async setSwap() {
        await this.$dialog(SetSwapDialog).show(this.data);
    }

    @ErrorProxy({ success: i18n.t("vmDetail.pruneImagesSuccess"), loading: i18n.t("loading") })
    private async pruneImages() {
        await deviceApi.pruneImages(this.data.address);
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.resetConfirm"), success: i18n.t("vmDetail.resetSuccess"), loading: i18n.t("loading") })
    private async resetHost() {
        await deviceApi.resetHost(this.data.address);
    }

    private async switchSDK() {
        await this.$dialog(SwitchSDKDialog).show(this.data);
        deviceApi.getSDKImages(this.data.address).then(e => this.sdk = e);
    }

    private async switchFirmware() {
        await this.$dialog(SwitchFirmwareDialog).show(this.data);
    }

    private async showDiscover() {
        await this.$dialog(DiscoverDialog).show(this.data.address);
    }

    private async onRenewVip() {
        const allHosts = await deviceApi.getHosts();
        const result = await this.$dialog(VipHostSelectDialog).show({
            hosts: allHosts
        });
        if (result) {
            // 刷新VIP信息
            this.loadVipInfo();
        }
    }

    private getStatus(percent: string | undefined): string | undefined {
        var re = this.getPercent(percent);
        if (re <= 30) {
            return "success";
        } else if (re <= 60) {
            return undefined;
        } else if (re <= 90) {
            return "warning";

        } else {
            return "exception";
        }
    }
    private getPercent(percent: string | undefined): number {
        if (percent) {
            return parseFloat(percent);
        } else {
            return 0.0;
        }
    }
}
