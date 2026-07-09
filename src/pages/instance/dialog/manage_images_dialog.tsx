import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo, DockerImageUsageInfo } from "@/api/device_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { Tools } from "@/common/common";

interface ImageTable {
    toggleRowSelection(row: DockerImageUsageInfo, selected: boolean): void;
}

@Dialog
export class ManageImagesDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "800px";
    public override height: string = "600px";

    protected images: DockerImageUsageInfo[] = [];
    protected selectedIds: string[] = [];
    protected loading: boolean = false;

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.manageImagesTitle").toString();
        this.data = data;
        this.loadImages();
        return super.show(data);
    }

    private async loadImages() {
        this.loading = true;
        try {
            this.images = await deviceApi.getDockerImagesWithUsage(this.data.address);
        } catch (e) {
            this.$message.error(`${e}`);
        } finally {
            this.loading = false;
        }
    }

    private get deletableCount(): number {
        return this.images.filter(img => img.usage_count === 0).length;
    }

    private onSelectionChange(selection: DockerImageUsageInfo[]) {
        this.selectedIds = selection.map(img => img.id);
    }

    private selectAllDeletable() {
        const table = this.$refs.imageTable as unknown as ImageTable;
        if (!table) return;
        this.images.forEach(img => {
            table.toggleRowSelection(img, img.usage_count === 0);
        });
    }

    private formatName(img: DockerImageUsageInfo): string {
        if (img.tags && img.tags.length > 0) return img.tags.join(", ");
        return img.id.replace(/^sha256:/, "").slice(0, 12);
    }

    @ErrorProxy({
        confirm: (self: ManageImagesDialog) => i18n.t("vmDetail.deleteImagesConfirm", [self.selectedIds.length]),
        success: i18n.t("vmDetail.deleteImagesSuccess"),
        loading: i18n.t("loading"),
    })
    private async deleteSelected() {
        if (this.selectedIds.length === 0) return;
        await deviceApi.deleteDockerImages(this.data.address, this.selectedIds);
        this.selectedIds = [];
        await this.loadImages();
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <Row crossAlign="center" gap={10} class="w-full">
                    <span style={{ color: "#909399", fontSize: "12px" }}>
                        {this.$t("vmDetail.manageImagesTip")}
                    </span>
                    <Row gap={10} class="ms-auto shrink-0">
                        <MyButton
                            type="danger"
                            disabled={this.selectedIds.length === 0}
                            text={`${this.$t("vmDetail.deleteSelectedImages", [this.selectedIds.length])}`}
                            onClick={this.deleteSelected}
                        />
                        <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close(false)} />
                    </Row>
                </Row>
            </div>
        );
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={12} style={{ padding: "20px", height: "100%" }}>
                <Row crossAlign="center" gap={10}>
                    <MyButton
                        type="primary"
                        size="small"
                        disabled={this.deletableCount === 0}
                        onClick={this.selectAllDeletable}
                    >
                        {this.$t("vmDetail.selectAllDeletableImages")}
                    </MyButton>
                </Row>
                <el-table
                    ref="imageTable"
                    data={this.images}
                    height="100%"
                    v-loading={this.loading}
                    row-key="id"
                    empty-text={this.$t("vmDetail.noDeletableImages").toString()}
                    on-selection-change={this.onSelectionChange}
                >
                    <el-table-column
                        type="selection"
                        width="55"
                        selectable={(row: DockerImageUsageInfo) => row.usage_count === 0}
                    />
                    <el-table-column
                        label={this.$t("vmDetail.imageColumnName")}
                        min-width="220"
                        scopedSlots={{
                            default: ({ row }: { row: DockerImageUsageInfo; }) => {
                                const name = this.formatName(row);
                                return (
                                    <el-tooltip effect="dark" content={name} placement="top" disabled={name.length <= 30}>
                                        <div class="truncate">{name}</div>
                                    </el-tooltip>
                                );
                            }
                        }}
                    />
                    <el-table-column
                        label={this.$t("vmDetail.imageColumnUsage")}
                        width="130"
                        align="center"
                        scopedSlots={{
                            default: ({ row }: { row: DockerImageUsageInfo; }) => {
                                if (row.usage_count > 0) {
                                    return <span style={{ color: "#F56C6C" }}>{this.$t("vmDetail.imageInUse", [row.usage_count])}</span>;
                                }
                                return <span style={{ color: "#67C23A" }}>{this.$t("vmDetail.imageNotInUse")}</span>;
                            }
                        }}
                    />
                    <el-table-column
                        label={this.$t("vmDetail.imageColumnSize")}
                        width="100"
                        align="right"
                        scopedSlots={{
                            default: ({ row }: { row: DockerImageUsageInfo; }) => Tools.getFileSize(row.size)
                        }}
                    />
                    <el-table-column
                        label={this.$t("vmDetail.imageColumnCreatedAt")}
                        width="170"
                        prop="created_at"
                    />
                </el-table>
            </Column>
        );
    }
}
