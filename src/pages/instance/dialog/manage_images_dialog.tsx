import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo, DockerImageUsageInfo, ImageInfo } from "@/api/device_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { Tools, makeVmApiUrl } from "@/common/common";
import { XzReadableStream } from "xz-decompress";

interface ImageTable {
    toggleRowSelection(row: DockerImageUsageInfo, selected: boolean): void;
}

type AddImageMode = "reference" | "upload";

interface AddImageDialogData {
    host: HostInfo;
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
    const base = filename.replace(/\.(tar\.gz|tgz|tar\.xz|txz|tar)$/i, "").toLowerCase();
    const name = base.replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "") || "custom-image";
    return `${name}:latest`;
}

// 顺序读取 tar 字节流的抽象：未压缩包用 File.slice 随机访问（不占内存），gzip 包只能顺序解压读取
interface TarByteSource {
    read(n: number): Promise<Uint8Array>;
    skip(n: number): Promise<void>;
}

class FileTarSource implements TarByteSource {
    private offset = 0;
    constructor(private file: File) { }
    async read(n: number): Promise<Uint8Array> {
        const bytes = new Uint8Array(await this.file.slice(this.offset, this.offset + n).arrayBuffer());
        this.offset += n;
        return bytes;
    }
    async skip(n: number): Promise<void> {
        this.offset += n;
    }
}

class StreamTarSource implements TarByteSource {
    private reader: ReadableStreamDefaultReader<Uint8Array>;
    private buffer = new Uint8Array(0);
    private streamDone = false;

    constructor(stream: ReadableStream<Uint8Array>) {
        this.reader = stream.getReader();
    }

    private async fill(min: number) {
        while (this.buffer.length < min && !this.streamDone) {
            const { value, done } = await this.reader.read();
            if (done) { this.streamDone = true; break; }
            const merged = new Uint8Array(this.buffer.length + value.length);
            merged.set(this.buffer);
            merged.set(value, this.buffer.length);
            this.buffer = merged;
        }
    }

    async read(n: number): Promise<Uint8Array> {
        await this.fill(n);
        const take = Math.min(n, this.buffer.length);
        const result = this.buffer.slice(0, take);
        this.buffer = this.buffer.slice(take);
        return result;
    }

    async skip(n: number): Promise<void> {
        let remaining = n;
        while (remaining > 0) {
            if (this.buffer.length > 0) {
                const take = Math.min(remaining, this.buffer.length);
                this.buffer = this.buffer.slice(take);
                remaining -= take;
                continue;
            }
            if (this.streamDone) break;
            const { value, done } = await this.reader.read();
            if (done) { this.streamDone = true; break; }
            this.buffer = new Uint8Array(value);
        }
    }
}

async function isGzipFile(file: File): Promise<boolean> {
    const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    return magic[0] === 0x1f && magic[1] === 0x8b;
}

// xz magic bytes: FD 37 7A 58 5A 00 ("\xFD7zXZ\0")
async function isXzFile(file: File): Promise<boolean> {
    const magic = new Uint8Array(await file.slice(0, 6).arrayBuffer());
    return magic[0] === 0xfd && magic[1] === 0x37 && magic[2] === 0x7a
        && magic[3] === 0x58 && magic[4] === 0x5a && magic[5] === 0x00;
}

async function openTarSource(file: File): Promise<TarByteSource> {
    if (await isGzipFile(file)) {
        return new StreamTarSource(file.stream().pipeThrough(new DecompressionStream("gzip")));
    }
    if (await isXzFile(file)) {
        return new StreamTarSource(new XzReadableStream(file.stream()));
    }
    return new FileTarSource(file);
}

async function getDockerArchiveInfo(file: File): Promise<DockerArchiveInfo> {
    const manifestReferences = new Set<string>();
    const indexReferences = new Set<string>();
    let isDockerArchive = false;

    const source = await openTarSource(file);

    while (true) {
        const header = await source.read(512);
        if (header.length < 512 || header.every(value => value === 0)) break;

        const name = readTarString(header, 0, 100);
        const prefix = readTarString(header, 345, 155);
        const path = prefix ? `${prefix}/${name}` : name;
        const sizeText = readTarString(header, 124, 12).replace(/\0/g, "").trim();
        const size = parseInt(sizeText || "0", 8);
        if (!Number.isFinite(size) || size < 0) {
            throw new Error(i18n.t("vmDetail.invalidImageTar").toString());
        }
        const paddedSize = Math.ceil(size / 512) * 512;

        if (path === "manifest.json") {
            isDockerArchive = true;
            const payload = await source.read(size);
            await source.skip(paddedSize - size);
            const manifest = JSON.parse(new TextDecoder().decode(payload));
            (manifest as Array<{ RepoTags?: string[]; }>).forEach(item =>
                (item.RepoTags ?? []).forEach(tag => manifestReferences.add(tag))
            );
        } else if (path === "index.json") {
            isDockerArchive = true;
            const payload = await source.read(size);
            await source.skip(paddedSize - size);
            const index = JSON.parse(new TextDecoder().decode(payload));
            (index.manifests ?? []).forEach((item: { annotations?: Record<string, string>; }) => {
                const tag = item.annotations?.["org.opencontainers.image.ref.name"];
                if (tag) indexReferences.add(tag);
            });
        } else {
            await source.skip(paddedSize);
        }
    }

    const references = manifestReferences.size > 0 ? manifestReferences : indexReferences;
    return { references: Array.from(references), isDockerArchive };
}

@Dialog
export class AddImageDialog extends CommonDialog<AddImageDialogData, boolean> {
    public override width: string = "500px";
    protected mode: AddImageMode = "upload";
    protected imageAddress: string = "";
    protected repositoryPart: string = "";
    protected tagPart: string = "";
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

    private async onFileChange(file: any) {
        this.imageFile = file?.raw ?? file ?? null;
        if (this.imageFile && !this.combinedRepositoryTag().trim()) {
            try {
                const archive = await getDockerArchiveInfo(this.imageFile);
                if (!archive.isDockerArchive) {
                    this.setRepositoryTag(imageReferenceFromFilename(this.imageFile.name));
                }
            } catch {
                // 仅用于预填，解析失败不影响正式提交时的校验
            }
        }
    }

    private async confirmUploadOverwrite(references: string[]): Promise<boolean> {
        if (references.length === 0) return true;
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
                const archive = await getDockerArchiveInfo(this.imageFile!);
                if (!archive.isDockerArchive && !this.combinedRepositoryTag().trim()) {
                    this.$message.error(this.$t("vmDetail.repositoryTagRequired").toString());
                    return;
                }
                const references = archive.isDockerArchive ? archive.references : [this.combinedRepositoryTag().trim()];
                if (!await this.confirmUploadOverwrite(references)) return;
                this.uploadTask = deviceApi.loadDockerImage(this.data.host.address, this.imageFile!, this.combinedRepositoryTag().trim(), references, event => {
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
                        <el-progress percentage={this.uploadProgress} />
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
        const url = makeVmApiUrl("image_api/export_archive", this.data.address);
        url.searchParams.set("image_name", img.id);
        window.open(url.toString(), "_blank");
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
