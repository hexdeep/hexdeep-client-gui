import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo, DockerImageUsageInfo, ImageInfo } from "@/api/device_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { Tools, makeVmApiUrl } from "@/common/common";
import s from "./manage_images_dialog.module.less";

interface ImageTable {
    toggleRowSelection(row: DockerImageUsageInfo, selected: boolean): void;
}

type AddImageMode = "reference" | "upload";

interface AddImageDialogData {
    host: HostInfo;
}

function imageReferenceFromFilename(filename: string): string {
    const base = filename.replace(/\.(tar\.gz|tgz|tar\.xz|txz|tar)$/i, "").toLowerCase();
    const name = base.replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "") || "custom-image";
    return `${name}:latest`;
}

@Dialog
export class AddImageDialog extends CommonDialog<AddImageDialogData, boolean> {
    public override width: string = "500px";
    protected mode: AddImageMode = "upload";
    protected imageAddress: string = "";
    protected repositoryPart: string = "android";
    protected tagPart: string = "v3";
    protected imageFile: File | null = null;
    protected submitting: boolean = false;
    protected uploadProgress: number = 0;
    protected progressStatus: string = "";
    protected uploadTask: { promise: Promise<any>, cancel: () => void; } | null = null;

    public override show(data: AddImageDialogData) {
        this.title = this.$t("vmDetail.addImageTitle").toString();
        return super.show(data);
    }

    public override close(result?: boolean): Promise<boolean> {
        if (this.uploadTask) this.uploadTask.cancel();
        return super.close(result);
    }

    private onModeChange() {
        this.imageAddress = "";
        this.imageFile = null;
        this.uploadProgress = 0;
        this.progressStatus = "";
    }

    private formatProgressStatus(status: string): string {
        const map: Record<string, string> = {
            downloading: this.$t("vmDetail.pullStatusDownloading").toString(),
            importing: this.$t("vmDetail.pullStatusImporting").toString(),
            inspecting: this.$t("vmDetail.loadStatusInspecting").toString(),
            // 导入 docker 阶段跟"pull"流程里的导入是同一个意思，复用同一句文案
            loading: this.$t("vmDetail.pullStatusImporting").toString(),
        };
        return map[status] ?? status;
    }

    private combinedRepositoryTag(): string {
        return this.tagPart ? `${this.repositoryPart}:${this.tagPart}` : this.repositoryPart;
    }

    private setRepositoryTag(value: string) {
        const idx = value.lastIndexOf(":");
        if (idx >= 0) {
            this.repositoryPart = value.slice(0, idx);
            this.tagPart = value.slice(idx + 1);
        } else {
            this.repositoryPart = value;
            this.tagPart = "";
        }
    }

    private async copyRepositoryTag() {
        const value = this.combinedRepositoryTag().trim();
        if (!value) return;
        await Tools.copyText(value);
        this.$message.success(this.$t("vmDetail.copySuccess").toString());
    }

    private onFileChange(file: any) {
        this.imageFile = file?.raw ?? file ?? null;
        // 只是按文件名猜一个默认值方便用户编辑：镜像包内容的解压/解析交给后端在上传时做，
        // 避免在浏览器里解压整个镜像包（尤其 xz 格式此前会卡住主线程好几秒）。
        if (this.imageFile && !this.combinedRepositoryTag().trim()) {
            this.setRepositoryTag(imageReferenceFromFilename(this.imageFile.name));
        }
    }

    private async confirmOverwrite(conflicts: string[]): Promise<boolean> {
        try {
            await this.$confirm(
                this.$t("vmDetail.imageReferenceConflictConfirm", [conflicts.join(", ")]).toString(),
                this.$t("confirm.title").toString(),
                {
                    confirmButtonText: this.$t("vmDetail.overwriteImage").toString(),
                    cancelButtonText: this.$t("confirm.cancel").toString(),
                    type: "warning"
                }
            );
            return true;
        } catch {
            return false;
        }
    }

    protected override async onConfirm() {
        if (this.submitting) return;
        if (this.mode === "reference" && !this.imageAddress.trim()) {
            this.$message.error(this.$t("vmDetail.imageAddressRequired").toString());
            return;
        }
        if (this.mode === "upload" && !this.imageFile) {
            this.$message.error(this.$t("vmDetail.imageFileRequired").toString());
            return;
        }

        this.submitting = true;
        this.uploadProgress = 0;
        this.progressStatus = "";
        try {
            if (this.mode === "reference") {
                this.uploadTask = deviceApi.pullImages(
                    this.data.host.address,
                    this.imageAddress.trim(),
                    this.combinedRepositoryTag().trim() || undefined,
                    (percent, status) => {
                        this.uploadProgress = Math.max(0, Math.min(100, percent));
                        this.progressStatus = status;
                    }
                );
                await this.uploadTask.promise;
            } else {
                // 分两段：先上传文件（不解压），再用 SSE 连着后端的解压扫描 tag + 冲突检测 + 必要时
                // 直接导入的整个过程，全程有真实百分比推回来。如果检测到会覆盖已有镜像，SSE 的终态
                // 事件会是 need_confirm + token，不会立即导入；确认后用 token 直接触发导入，不需要
                // 重新上传文件。每段开始前都重新赋值 uploadTask，保证对话框中途关闭时 close() 里的
                // uploadTask.cancel() 取消的是当前正在跑的那一段。
                this.uploadTask = deviceApi.uploadImageFile(this.data.host.address, this.imageFile!, percent => {
                    this.uploadProgress = Math.max(0, Math.min(100, percent));
                    this.progressStatus = "";
                });
                const { token } = await this.uploadTask.promise;

                this.uploadTask = deviceApi.loadImageSSE(
                    this.data.host.address, token, this.combinedRepositoryTag().trim(),
                    (percent, status) => {
                        this.uploadProgress = Math.max(0, Math.min(100, percent));
                        this.progressStatus = status;
                    }
                );
                const result = await this.uploadTask.promise;
                if (result.status === "need_confirm") {
                    if (await this.confirmOverwrite(result.conflicts)) {
                        await deviceApi.confirmLoadDockerImage(this.data.host.address, result.token);
                    } else {
                        await deviceApi.cancelLoadDockerImage(this.data.host.address, result.token);
                        return;
                    }
                }
            }
            this.$message.success(this.$t("vmDetail.addImageSuccess").toString());
            await this.close(true);
        } catch (error) {
            if (error !== "aborted") {
                this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            }
        } finally {
            this.uploadTask = null;
            this.submitting = false;
        }
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "20px" }}>
                <el-form-item label={this.$t("vmDetail.imageImportMode")}>
                    <el-radio-group
                        v-model={this.mode}
                        disabled={this.submitting}
                        on-change={this.onModeChange}
                    >
                        <el-radio-button label="reference">{this.$t("vmDetail.customImage")}</el-radio-button>
                        <el-radio-button label="upload">{this.$t("vmDetail.uploadImage")}</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                {this.mode === "reference" ? (
                    <el-form-item label={this.$t("vmDetail.imageAddress")}>
                        <el-input
                            type="textarea"
                            rows={3}
                            v-model={this.imageAddress}
                            disabled={this.submitting}
                            placeholder={this.$t("vmDetail.imageAddressPlaceholder")}
                        />
                    </el-form-item>
                ) : (
                    <el-form-item label={this.$t("vmDetail.imageTarFile")}>
                        <el-upload
                            action="#"
                            accept=".tar,.tar.gz,.tgz,.tar.xz,.txz,application/x-tar,application/gzip,application/x-xz"
                            multiple={false}
                            limit={1}
                            auto-upload={false}
                            disabled={this.submitting}
                            attrs={{ "on-change": this.onFileChange }}
                            on-remove={() => { this.imageFile = null; }}
                        >
                            <MyButton size="small" disabled={this.submitting} text={this.$t("vmDetail.selectImageFile")} />
                        </el-upload>
                    </el-form-item>
                )}
                <el-form-item label={this.$t("vmDetail.imageRepositoryTag")}>
                    <Row crossAlign="center" gap={6}>
                        <el-input
                            v-model={this.repositoryPart}
                            disabled={this.submitting}
                            placeholder={this.$t("vmDetail.imageRepositoryPlaceholder")}
                        />
                        <span>:</span>
                        <el-input
                            v-model={this.tagPart}
                            disabled={this.submitting}
                            placeholder={this.$t("vmDetail.imageTagPlaceholder")}
                        />
                        <el-button
                            type="text"
                            icon="el-icon-document-copy"
                            class="shrink-0"
                            onClick={() => this.copyRepositoryTag()}
                        />
                    </Row>
                </el-form-item>
                {this.submitting && (
                    <el-form-item>
                        <el-progress
                            percentage={this.uploadProgress}
                            class={this.progressStatus === "loading" ? s.indeterminate : undefined}
                        />
                        {this.progressStatus && (
                            <div style={{ fontSize: "12px", color: "#909399" }}>{this.formatProgressStatus(this.progressStatus)}</div>
                        )}
                    </el-form-item>
                )}
            </el-form>
        );
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton
                    type="primary"
                    disabled={this.submitting}
                    text={this.submitting ? this.$t("loading") : this.$t("confirm.ok")}
                    onClick={() => this.onConfirm()}
                />
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}

type ExportImageFormat = "tar" | "gz";

interface ExportImageDialogData {
    host: HostInfo;
    image: DockerImageUsageInfo;
}

@Dialog
export class ExportImageDialog extends CommonDialog<ExportImageDialogData, boolean> {
    public override width: string = "420px";
    protected format: ExportImageFormat = "tar";
    protected submitting: boolean = false;
    protected progress: number = 0;
    protected progressStatus: string = "";
    protected exportTask: { promise: Promise<any>, cancel: () => void; } | null = null;

    public override show(data: ExportImageDialogData) {
        this.title = this.$t("vmDetail.exportImageTitle").toString();
        return super.show(data);
    }

    public override close(result?: boolean): Promise<boolean> {
        if (this.exportTask) this.exportTask.cancel();
        return super.close(result);
    }

    protected override async onConfirm() {
        if (this.submitting) return;
        this.submitting = true;
        this.progress = 0;
        this.progressStatus = "";
        try {
            if (this.format === "tar") {
                const url = makeVmApiUrl("image_api/export_archive", this.data.host.address);
                url.searchParams.set("image_name", this.data.image.id);
                window.open(url.toString(), "_blank");
            } else {
                this.exportTask = deviceApi.exportImageArchiveSSE(
                    this.data.host.address,
                    this.data.image.id,
                    "gz",
                    (percent, status) => {
                        this.progress = Math.max(0, Math.min(100, percent));
                        this.progressStatus = status;
                    }
                );
                const { token } = await this.exportTask.promise;
                window.open(deviceApi.exportImageArchiveDownloadUrl(this.data.host.address, token), "_blank");
            }
            await this.close(true);
        } catch (error) {
            if (error !== "aborted") {
                this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            }
        } finally {
            this.exportTask = null;
            this.submitting = false;
        }
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "20px" }}>
                <el-form-item label={this.$t("vmDetail.exportFormat")}>
                    <el-radio-group v-model={this.format} disabled={this.submitting}>
                        <el-radio-button label="tar">tar</el-radio-button>
                        <el-radio-button label="gz">tar.gz</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                {this.submitting && this.format === "gz" && (
                    <el-form-item>
                        <el-progress percentage={this.progress} />
                        {this.progressStatus && (
                            <div style={{ fontSize: "12px", color: "#909399" }}>{this.$t("vmDetail.exportStatusExporting")}</div>
                        )}
                    </el-form-item>
                )}
            </el-form>
        );
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton
                    type="primary"
                    disabled={this.submitting}
                    text={this.submitting ? this.$t("loading") : this.$t("confirm.ok")}
                    onClick={() => this.onConfirm()}
                />
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}

@Dialog
export class ManageImagesDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "800px";
    public override height: string = "600px";

    protected images: DockerImageUsageInfo[] = [];
    protected selectedIds: string[] = [];
    protected loading: boolean = false;
    // 镜像地址 -> 名称，来自 /image_api/get（云机可用镜像目录），用于把地址翻译成可读名称
    protected imageNameMap: Record<string, string> = {};

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.manageImagesTitle").toString();
        this.data = data;
        this.loadImages();
        this.loadImageNames();
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

    private async loadImageNames() {
        try {
            const catalog: ImageInfo[] = await deviceApi.getImages(this.data.address);
            const map: Record<string, string> = {};
            catalog.forEach(img => { map[img.address] = img.name; });
            this.imageNameMap = map;
        } catch (e) {
            // 翻译只是锦上添花，取不到名称目录时保留显示原始地址即可
            console.warn(e);
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

    private async addImage() {
        const added = await this.$dialog(AddImageDialog).show({ host: this.data });
        if (added) await this.loadImages();
    }

    private formatName(img: DockerImageUsageInfo): string {
        if (img.tags && img.tags.length > 0) {
            const names = img.tags.map(tag => this.imageNameMap[tag] ?? tag);
            return names.join(", ");
        }
        return img.id.replace(/^sha256:/, "").slice(0, 12);
    }

    private formatAddress(img: DockerImageUsageInfo): string {
        if (img.tags && img.tags.length > 0) {
            return img.tags.join(", ");
        }
        return img.id;
    }

    private async copyAddress(img: DockerImageUsageInfo) {
        await Tools.copyText(this.formatAddress(img));
        this.$message.success(this.$t("vmDetail.copySuccess").toString());
    }

    private exportImage(img: DockerImageUsageInfo) {
        // 用镜像 id 而非 tags：镜像可能没有 tag（悬空镜像）或有多个 tag，id 总是唯一且有效
        this.$dialog(ExportImageDialog).show({ host: this.data, image: img });
    }

    @ErrorProxy({
        confirm: (self: ManageImagesDialog) => i18n.t("vmDetail.deleteImagesConfirm", [self.selectedIds.length]),
        success: i18n.t("vmDetail.deleteImagesSuccess"),
        loading: i18n.t("loading"),
    })
    private async deleteSelected() {
        if (this.selectedIds.length === 0) return;
        const failed = await deviceApi.deleteDockerImages(this.data.address, this.selectedIds);
        this.selectedIds = [];
        await this.loadImages();

        const failedIds = Object.keys(failed);
        if (failedIds.length > 0) {
            this.$alert(
                failedIds.map(id => `${id.slice(0, 12)}: ${failed[id]}`).join("; "),
                this.$t("vmDetail.deleteImagesPartialFailed").toString(),
                { type: "warning" }
            );
            return false;
        }
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer" style={{ paddingLeft: "20px", paddingRight: "20px" }}>
                <Row crossAlign="center" gap={10} class="w-full">
                    <span style={{ color: "#909399", fontSize: "12px" }}>
                        {this.$t("vmDetail.manageImagesTip")}
                    </span>
                    <Row gap={10} class="ms-auto shrink-0">
                        <MyButton
                            type="danger"
                            plain
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
                    <MyButton type="primary" size="small" onClick={this.addImage}>
                        {this.$t("vmDetail.addImage")}
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
                        type="index"
                        label={this.$t("vmDetail.imageColumnIndex")}
                        width="70"
                        align="center"
                    />
                    <el-table-column
                        label={this.$t("vmDetail.imageColumnNameWithCount", [this.images.length])}
                        min-width="220"
                        scopedSlots={{
                            default: ({ row }: { row: DockerImageUsageInfo; }) => {
                                const name = this.formatName(row);
                                return (
                                    <Row crossAlign="center" gap={2}>
                                        <el-tooltip effect="dark" content={name} placement="top" open-delay={1000} disabled={name.length <= 30}>
                                            <div class="truncate">{name}</div>
                                        </el-tooltip>
                                        <el-button
                                            type="text"
                                            icon="el-icon-document-copy"
                                            class="shrink-0"
                                            onClick={() => this.copyAddress(row)}
                                        />
                                        <el-tooltip effect="dark" content={this.$t("vmDetail.exportImage").toString()} placement="top">
                                            <el-button
                                                type="text"
                                                icon="el-icon-download"
                                                class="shrink-0"
                                                onClick={() => this.exportImage(row)}
                                            />
                                        </el-tooltip>
                                    </Row>
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
