import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo } from "@/api/device_define";

@Dialog
export class CleanGarbageDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "600px";

    protected files: string[] = [];
    protected form = {
        files: [] as string[],
        checkAll: false,
        cleanImages: false,   // ⭐ 新增：是否清理镜像
    };

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.cleanupGarbage").toString();
        this.data = data;

        // 获取可清理文件列表
        const res = await deviceApi.getGarbageFiles(data.address);
        this.files = res;

        // 默认全选文件
        this.form.files = [...this.files];
        this.form.checkAll = true;

        // 默认不勾选清理镜像（如需默认勾选可改为 true）
        this.form.cleanImages = false;

        return super.show(data);
    }

    protected onCheckAllChange(val: boolean) {
        this.form.files = val ? [...this.files] : [];
    }

    protected onCheckedChange(value: string[]) {
        this.form.checkAll = value.length === this.files.length;
    }



    @ErrorProxy({ success: i18n.t("vmDetail.cleanupGarbageSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        // 什么都没选，直接关闭
        if (this.form.files.length === 0 && !this.form.cleanImages) {
            this.close(false);
            return;
        }

        // 清理文件
        if (this.form.files.length > 0) {
            await deviceApi.clearGarbageFiles(
                this.data.address,
                {
                    files: this.form.files,
                }
            );
        }

        // ⭐ 清理镜像
        if (this.form.cleanImages) {
            await deviceApi.pruneImages(this.data.address);
        }

        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top">
                {/* 全选 + 清理镜像 */}
                <el-form-item>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                        }}
                    >
                        <el-checkbox
                            v-model={this.form.checkAll}
                            onChange={this.onCheckAllChange.bind(this)}
                        >
                            {this.$t("selectAll")}
                        </el-checkbox>

                        {/* <el-checkbox v-model={this.form.cleanImages}>
                            {this.$t("vmDetail.pruneImages")}
                        </el-checkbox> */}
                    </div>
                </el-form-item>

                {/* 文件列表 */}
                <el-form-item>
                    <div
                        style={{
                            maxHeight: "300px",
                            overflowY: "auto",
                            overflowX: "hidden",
                        }}
                    >
                        <el-checkbox-group
                            v-model={this.form.files}
                            onChange={this.onCheckedChange.bind(this)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            {this.files.map(file => (
                                <el-checkbox
                                    key={file}
                                    label={file}
                                    style={{
                                        width: "100%",
                                        overflow: "hidden",
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                        title={file}
                                    >
                                        {file}
                                    </span>
                                </el-checkbox>
                            ))}
                        </el-checkbox-group>
                    </div>
                </el-form-item>
            </el-form>
        );
    }
}
