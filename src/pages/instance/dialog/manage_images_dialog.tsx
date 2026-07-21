import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo, DockerImageUsageInfo, ImageInfo } from "@/api/device_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { Tools } from "@/common/common";

interface ImageTable {
    toggleRowSelection(row: DockerImageUsageInfo, selected: boolean): void;
}

type AddImageMode = "reference" | "upload";

interface AddImageDialogData {
    host: HostInfo;
}

interface EditImageNameDialogData {
    host: HostInfo;
    image: DockerImageUsageInfo;
}

function readTarString(bytes: Uint8Array, start: number, length: number): string {
    const end = bytes.indexOf(0, start);
    const actualEnd = end >= start && end < start + length ? end : start + length;
    return new TextDecoder().decode(bytes.slice(start, actualEnd)).trim();
}

interface DockerArchiveInfo {
    references: string[];
    isDockerArchive: boolean;
}

function imageReferenceFromFilename(filename: string): string {
    const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
    const name = base.replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "") || "custom-image";
    return `${name}:latest`;
}

async function getDockerArchiveInfo(file: File): Promise<DockerArchiveInfo> {
    const manifestReferences = new Set<string>();
    const indexReferences = new Set<string>();
    let isDockerArchive = false;
    let offset = 0;

    while (offset + 512 <= file.size) {
        const header = new Uint8Array(await file.slice(offset, offset + 512).arrayBuffer());
        if (header.every(value => value === 0)) break;

        const name = readTarString(header, 0, 100);
        const prefix = readTarString(header, 345, 155);
        const path = prefix ? `${prefix}/${name}` : name;
        const sizeText = readTarString(header, 124, 12).replace(/\0/g, "").trim();
        const size = parseInt(sizeText || "0", 8);
        if (!Number.isFinite(size) || size < 0) {
            throw new Error(i18n.t("vmDetail.invalidImageTar").toString());
        }

        if (path === "manifest.json") {
            isDockerArchive = true;
            const manifest = JSON.parse(await file.slice(offset + 512, offset + 512 + size).text());
            (manifest as Array<{ RepoTags?: string[]; }>).forEach(item =>
                (item.RepoTags ?? []).forEach(tag => manifestReferences.add(tag))
            );
        } else if (path === "index.json") {
            isDockerArchive = true;
            const index = JSON.parse(await file.slice(offset + 512, offset + 512 + size).text());
            (index.manifests ?? []).forEach((item: { annotations?: Record<string, string>; }) => {
                const tag = item.annotations?.["org.opencontainers.image.ref.name"];
                if (tag) indexReferences.add(tag);
            });
        }

        offset += 512 + Math.ceil(size / 512) * 512;
    }

    const references = manifestReferences.size > 0 ? manifestReferences : indexReferences;
    return { references: Array.from(references), isDockerArchive };
}

@Dialog
export class AddImageDialog extends CommonDialog<AddImageDialogData, boolean> {
    public override width: string = "500px";
    protected mode: AddImageMode = "reference";
    protected imageReference: string = "";
    protected imageName: string = "";
    protected imageFile: File | null = null;
    protected submitting: boolean = false;
    protected uploadProgress: number = 0;
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
        this.imageReference = "";
        this.imageFile = null;
        this.uploadProgress = 0;
    }

    private onFileChange(file: any) {
        this.imageFile = file?.raw ?? file ?? null;
    }

    private async confirmUploadOverwrite(file: File): Promise<boolean> {
        const archive = await getDockerArchiveInfo(file);
        const references = archive.isDockerArchive ? archive.references : [imageReferenceFromFilename(file.name)];
        const conflicts = await deviceApi.getImageReferenceConflicts(this.data.host.address, references);
        if (conflicts.length === 0) return true;

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

    private async getUploadReferences(file: File): Promise<string[]> {
        const archive = await getDockerArchiveInfo(file);
        return archive.isDockerArchive ? archive.references : [imageReferenceFromFilename(file.name)];
    }

    protected override async onConfirm() {
        if (this.submitting) return;
        if (this.mode === "reference" && !this.imageReference.trim()) {
            this.$message.error(this.$t("vmDetail.imageReferenceRequired").toString());
            return;
        }
        if (this.mode === "upload" && !this.imageFile) {
            this.$message.error(this.$t("vmDetail.imageFileRequired").toString());
            return;
        }
        if (!this.imageName.trim()) {
            this.$message.error(this.$t("vmDetail.imageNameRequired").toString());
            return;
        }

        this.submitting = true;
        try {
            if (this.mode === "reference") {
                await deviceApi.pullImages(this.data.host.address, this.imageReference.trim(), this.imageName.trim());
            } else {
                if (!await this.confirmUploadOverwrite(this.imageFile!)) return;
                const references = await this.getUploadReferences(this.imageFile!);
                this.uploadTask = deviceApi.loadDockerImage(this.data.host.address, this.imageFile!, this.imageName.trim(), references, event => {
                    if (event.lengthComputable) {
                        this.uploadProgress = Math.round(event.loaded / event.total * 100);
                    }
                });
                await this.uploadTask.promise;
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
                    <el-select
                        v-model={this.mode}
                        disabled={this.submitting}
                        style={{ width: "100%" }}
                        on-change={this.onModeChange}
                    >
                        <el-option value="reference" label={this.$t("vmDetail.customImage").toString()} />
                        <el-option value="upload" label={this.$t("vmDetail.uploadImage").toString()} />
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("vmDetail.imageDisplayName")}>
                    <el-input
                        v-model={this.imageName}
                        disabled={this.submitting}
                        placeholder={this.$t("vmDetail.imageDisplayNamePlaceholder")}
                    />
                </el-form-item>
                {this.mode === "reference" ? (
                    <el-form-item label={this.$t("vmDetail.imageReference")}>
                        <el-input
                            v-model={this.imageReference}
                            disabled={this.submitting}
                            placeholder={this.$t("vmDetail.imageReferencePlaceholder")}
                        />
                    </el-form-item>
                ) : (
                    <el-form-item label={this.$t("vmDetail.imageTarFile")}>
                        <el-upload
                            action="#"
                            accept=".tar,application/x-tar"
                            multiple={false}
                            limit={1}
                            auto-upload={false}
                            disabled={this.submitting}
                            attrs={{ "on-change": this.onFileChange }}
                            on-remove={() => { this.imageFile = null; }}
                        >
                            <MyButton size="small" disabled={this.submitting} text={this.$t("vmDetail.selectImageFile")} />
                        </el-upload>
                        {this.submitting && <el-progress percentage={this.uploadProgress} />}
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
                <MyButton disabled={this.submitting} text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}

@Dialog
export class EditImageNameDialog extends CommonDialog<EditImageNameDialogData, boolean> {
    public override width: string = "500px";
    protected reference: string = "";
    protected imageName: string = "";
    protected submitting: boolean = false;

    public override show(data: EditImageNameDialogData) {
        this.title = this.$t("vmDetail.editImageNameTitle").toString();
        this.reference = data.image.tags[0] ?? "";
        this.imageName = data.image.custom_names?.[this.reference] ?? "";
        return super.show(data);
    }

    private onReferenceChange(reference: string) {
        this.imageName = this.data.image.custom_names?.[reference] ?? "";
    }

    protected override async onConfirm() {
        if (this.submitting) return;
        if (!this.reference) {
            this.$message.error(this.$t("vmDetail.imageReferenceRequired").toString());
            return;
        }
        if (!this.imageName.trim()) {
            this.$message.error(this.$t("vmDetail.imageNameRequired").toString());
            return;
        }

        this.submitting = true;
        try {
            await deviceApi.setCustomImageName(this.data.host.address, this.reference, this.imageName.trim());
            this.$message.success(this.$t("vmDetail.editImageNameSuccess").toString());
            await this.close(true);
        } catch (error) {
            this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
        } finally {
            this.submitting = false;
        }
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "20px" }}>
                <el-form-item label={this.$t("vmDetail.imageReference")}>
                    <el-select
                        v-model={this.reference}
                        disabled={this.submitting}
                        style={{ width: "100%" }}
                        on-change={this.onReferenceChange}
                    >
                        {this.data.image.tags.map(reference => (
                            <el-option key={reference} value={reference} label={reference} />
                        ))}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("vmDetail.imageDisplayName")}>
                    <el-input
                        v-model={this.imageName}
                        disabled={this.submitting}
                        placeholder={this.$t("vmDetail.imageDisplayNamePlaceholder")}
                    />
                </el-form-item>
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
                <MyButton disabled={this.submitting} text={this.$t("confirm.cancel")} onClick={() => this.close()} />
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
            const names = img.tags.map(tag => img.custom_names?.[tag] ?? this.imageNameMap[tag] ?? tag);
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

    private async editImageName(img: DockerImageUsageInfo) {
        if (!img.tags?.length) return;
        const updated = await this.$dialog(EditImageNameDialog).show({ host: this.data, image: img });
        if (updated) await this.loadImages();
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
                                        <el-tooltip effect="dark" content={name} placement="top" open-delay={2000} disabled={name.length <= 30}>
                                            <div class="truncate">{name}</div>
                                        </el-tooltip>
                                        <el-button
                                            type="text"
                                            icon="el-icon-document-copy"
                                            class="shrink-0"
                                            onClick={() => this.copyAddress(row)}
                                        />
                                        <el-button
                                            type="text"
                                            icon="el-icon-edit"
                                            class="shrink-0"
                                            disabled={!row.tags?.length}
                                            onClick={() => this.editImageName(row)}
                                        />
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
