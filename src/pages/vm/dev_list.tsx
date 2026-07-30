import { deviceApi, VipImageRestrictedError } from '@/api/device_api';
import { DeviceInfo, HostInfo, ImageInfo, MyConfig, MyTreeNode, TreeConfig } from '@/api/device_define';
import { filterWithConfig, getPrefixName, getSuffixName, makeVmApiUrl, sleep, sortDevicesByHostIp } from '@/common/common';
import { i18n } from '@/i18n/i18n';
import { ModelSelectotDialog } from '@/lib/component/model_selector';
import { Column, Row } from '@/lib/container';
import { ErrorProxy } from '@/lib/error_handle';
import { TextButton } from '@/lib/my_button';
import { Component, InjectReactive, Prop, Ref, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import { DynamicScroller, DynamicScrollerItem, RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import s from './dev_list.module.less';
import { openAdbShell } from './dialog/adb_shell';
import { CloneVmDialog } from './dialog/clone_vm';
import { ExportModelDialog } from './dialog/export_model';
import { ImportModelDialog } from './dialog/import_model';
import { ScreenMirrorDialog } from './dialog/screen_mirror';
import { ShakeDialog } from './dialog/shake';
import { CreateDialog } from './dialog/create';
import { FilelistDialog } from './dialog/filelist';
import { PullImageDialog } from './dialog/pull_image';
import { RenameDialog } from './dialog/rename';
import { S5setDialog } from './dialog/s5set';
import { UploadFileDialog } from './dialog/upload_file';
import { VmDetailDialog } from './dialog/vm_detail';
import { VipHostSelectDialog } from './dialog/vip_host_select';
import { Screenshot } from './screenshot';
import { Icon } from '@iconify/vue2';
import moreVert from '@iconify-icons/mdi/more-vert';

@Component
class OverflowTooltip extends tsx.Component<{ content: string; openDelay?: number }> {
    @Prop() private content!: string;
    // 悬停多久后才弹出 tooltip，单位 ms，默认不延迟；镜像列需要悬停 1 秒后才弹出
    @Prop({ default: 0 }) private openDelay!: number;
    private disabled = false;

    private onMouseEnter(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.scrollWidth > target.clientWidth) {
            this.disabled = false;
        } else {
            this.disabled = true;
        }
    }

    render() {
        return (
            <el-tooltip content={this.content} placement="top" enterable={true} disabled={this.disabled} openDelay={this.openDelay}>
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onMouseenter={this.onMouseEnter}>
                    {this.$slots.default ?? this.content}
                </div>
            </el-tooltip>
        );
    }
}

@Component
export class DeviceList extends tsx.Component<IProps, IEvents> {
    @InjectReactive() protected hostTree!: MyTreeNode[];
    @InjectReactive() private treeConfig!: TreeConfig[];
    @InjectReactive() private rightChecked!: string[];
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private config!: MyConfig;
    @InjectReactive() private images!: ImageInfo[];
    @Ref() private gridContainer?: HTMLDivElement;

    // 网格卡片尺寸需与 dev_list.module.less 中 .v_img/.h_img 的宽度保持一致，用于按容器宽度计算每行可容纳的卡片数
    private static readonly CARD_WIDTH: Record<string, number> = { vertical: 176 + 2, horizontal: 301 + 2 };
    private static readonly GRID_GAP = 10;
    // 网格单行（RecycleScroller 主轴）高度：截图区（.v_img/.h_img 固定高）+ 勾选/操作行 + 行间距，须 >= 卡片实际高度以免重叠
    private static readonly ROW_HEIGHT: Record<string, number> = { vertical: 365, horizontal: 220 };

    private containerWidth = 0;
    private resizeObserver?: ResizeObserver;
    private observedEl?: HTMLElement;

    private get data2(): DeviceInfo[] {
        var re = this.hostTree.flatMap(x => x.children?.filter(y => {
            return y.selected && filterWithConfig(this.config, y.value);
        }) || []).map(t => t.value);
        // 应用排序算法：先按主机IP排序，再按index排序，最后按创建时间降序排序
        re = sortDevicesByHostIp(re);
        return re;
    }

    // 当前展示的云机集合签名（key + 运行状态）。仅当集合或某台云机的运行状态变化时才变，
    // 用于触发 git commit id 拉取，避免把网络请求放进 data2 getter 里导致每次重算都重新请求。
    private get deviceGitSignature(): string {
        return this.data2.map(d => `${d.key}:${d.state}`).join(",");
    }

    @Watch("deviceGitSignature", { immediate: true })
    private onDeviceSetChange() {
        this.fillGitCommitId(this.data2);
    }

    private get itemsPerRow(): number {
        if (this.config.view !== 'vertical' && this.config.view !== 'horizontal') return 1;
        const step = DeviceList.CARD_WIDTH[this.config.view] + DeviceList.GRID_GAP;
        return Math.max(1, Math.floor((this.containerWidth + DeviceList.GRID_GAP) / step));
    }

    // RecycleScroller 网格模式的单元格宽度（含右侧间距），与 itemsPerRow 的步长一致
    private get gridItemSecondarySize(): number {
        const view = this.config.view;
        if (view !== 'vertical' && view !== 'horizontal') return DeviceList.CARD_WIDTH.vertical + DeviceList.GRID_GAP;
        return DeviceList.CARD_WIDTH[view] + DeviceList.GRID_GAP;
    }

    private get gridRowHeight(): number {
        const view = this.config.view;
        if (view !== 'vertical' && view !== 'horizontal') return DeviceList.ROW_HEIGHT.vertical;
        return DeviceList.ROW_HEIGHT[view];
    }

    // 计算主机IP到颜色索引的映射，同一主机颜色相同，不同主机交替颜色
    private get hostColorMap(): Map<string, number> {
        const map = new Map<string, number>();
        let colorIndex = 0;
        for (const device of this.data2) {
            if (!map.has(device.hostIp)) {
                map.set(device.hostIp, colorIndex++);
            }
        }
        return map;
    }

    private getHostColorIndex(hostIp: string): number {
        return this.hostColorMap.get(hostIp) || 0;
    }

    protected async created() {
    }

    protected mounted() {
        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                this.containerWidth = entry.contentRect.width;
            }
        });
    }

    protected updated() {
        if (this.gridContainer && this.observedEl !== this.gridContainer) {
            this.resizeObserver?.disconnect();
            this.resizeObserver?.observe(this.gridContainer);
            this.observedEl = this.gridContainer;
        }
    }

    protected beforeDestroy() {
        this.resizeObserver?.disconnect();
    }

    private async fillGitCommitId(devices: DeviceInfo[]) {
        devices.forEach(async (device) => {

            if (device.state != "running") {
                return;
            }

            // 已拿到 git commit id 的云机不再重复请求，避免勾选变化时整屏重新拉取
            if (device.git_commit_id) {
                return;
            }

            try {
                deviceApi.getContainerGitCommitIdMacvlan(device.android_sdk).then((gitCommitId: string) => {
                    this.$set(device, 'git_commit_id', gitCommitId);
                });
            } catch (e) {

            }

        });
    }

    public selectAll() {
        if (this.rightChecked.length == this.data2.length) {
            this.rightChecked.clear();
        } else {
            this.rightChecked.clear();
            this.rightChecked.push(...this.data2.map(e => e.key!));
        }
        this.$emit("selectChange", this.rightChecked);
    }

    @Watch("data2", { deep: true })
    public selectedDevicesChange() {
        for (let i = this.rightChecked.length - 1; i >= 0; i--) {
            const element = this.rightChecked[i];
            if (this.data2.find(x => x.key == element) == null) {
                this.rightChecked.splice(i, 1);
            }
        }
    }

    private checkboxChanged(e: boolean, e2: DeviceInfo) {
        if (!e) {
            this.rightChecked.removeWhere(x => x == e2.key);
        } else {
            this.rightChecked.push(e2.key!);
        }
        this.$emit("selectChange", this.rightChecked);
    }

    protected renderStatus(r: DeviceInfo) {
        if (r.state == "running") {
            return <el-tag type="success">{this.$t(r.state).toString()}</el-tag>;
        } else {
            return <el-tag type="danger">{this.$t(r.state).toString()}</el-tag>;
        }
    }

    protected renderStatus2(r: DeviceInfo) {
        return <span class={[s.status, r.state == "running" ? s.running : s.no_run]} title={this.$t(r.state == "running" ? "running" : "noRun").toString()}> </span>;
    }

    private renderVmImage(r: DeviceInfo): ImageInfo | undefined {
        return this.images.find(x => x.address == r.image_addr);
    }

    protected render() {
        return (
            <div class={[s.deviceList, "contentBox"]}>
                {this.config.view == "list" && this.renderListView()}
                {(this.config.view == "horizontal" || this.config.view == "vertical") && this.renderGridView()}
            </div>
        );
    }

    private renderListView() {
        return (
            <div class={s.table}>
                <div class={s.listHeader}>
                    <div class={[s.listCell, s.colSelection]}>
                        <el-checkbox
                            value={this.data2.length > 0 && this.rightChecked.length == this.data2.length}
                            indeterminate={this.rightChecked.length > 0 && this.rightChecked.length < this.data2.length}
                            onChange={() => this.selectAll()}
                        />
                    </div>
                    <div class={[s.listCell, s.colNo]}>No</div>
                    <div class={[s.listCell, s.colName]}>{this.$t("name")}</div>
                    <div class={[s.listCell, s.colAdb]}>{this.$t("vmDetail.adb")}</div>
                    <div class={[s.listCell, s.colCreatedAt]}>{this.$t("createdAt")}</div>
                    <div class={[s.listCell, s.colGit]}>{this.$t("vmDetail.containerGitCommitId")}</div>
                    <div class={[s.listCell, s.colImage]}>{this.$t("vmImage")}</div>
                    <div class={[s.listCell, s.colState]}>{this.$t("state")}</div>
                    <div class={[s.listCell, s.colAction]}>{this.$t("action")}</div>
                </div>
                {this.data2.length == 0 ? (
                    <div class={s.emptyText}>{this.$t("table.emptyText")}</div>
                ) : (
                    <el-checkbox-group value={this.rightChecked} class={s.listBody}>
                        <DynamicScroller
                            items={this.data2}
                            minItemSize={48}
                            keyField="key"
                            class={s.scroller}
                            scopedSlots={{
                                default: ({ item, index, active }: { item: DeviceInfo; index: number; active: boolean; }) => (
                                    <DynamicScrollerItem item={item} active={active} dataIndex={index} class={s.listRow}>
                                        {this.renderListRow(item)}
                                    </DynamicScrollerItem>
                                )
                            }}
                        />
                    </el-checkbox-group>
                )}
            </div>
        );
    }

    private renderListRow(row: DeviceInfo) {
        const name = getSuffixName(row.name);
        const colorClass = this.getHostColorIndex(row.hostIp) % 2 === 0 ? 'text-green-600' : 'text-blue-600';
        const img = this.renderVmImage(row);
        // 临时修复：跨主机合并镜像列表时 e.id 可能被未拉取该镜像的主机记录覆盖为 ""，
        // 此时无法判断真实下载状态，暂按"已是最新"处理，避免误报叉号。
        // 根因见 /root/vm_image_cross_investigation.md，需要按 host 隔离镜像列表后移除。
        const download = img ? (img.id === "" || row.image_digest === img.id) : false;
        const imageText = img ? img.name : row.image_addr;
        const gitText = `${row.git_commit_id ?? ""}${row.create_req?.mobile_model_version === "v3" ? "[v3]" : ""}`;
        return [
            <div class={[s.listCell, s.colSelection]}>
                {/* el-checkbox 在没有默认插槽内容时会把 label 当作可见文本回退显示，这里传入空 span 阻止该行为 */}
                <el-checkbox label={row.key} onChange={(c: boolean) => this.checkboxChanged(c, row)}><span /></el-checkbox>
            </div>,
            <div class={[s.listCell, s.colNo]}>{row.index}</div>,
            <div class={[s.listCell, s.colName]}>
                {name === "开通VIP显示全部" ? (
                    <OverflowTooltip
                        content={name}
                        style="color: var(--main-color); cursor: pointer; text-decoration: underline;"
                        nativeOnClick={() => this.showVipDialog()}
                    />
                ) : (
                    <OverflowTooltip content={name} />
                )}
            </div>,
            <div class={[s.listCell, s.colAdb]} attrs={{ title: row.adb }}>
                <span class={colorClass}>{this.formatAdb(row.adb)}</span>
            </div>,
            <div class={[s.listCell, s.colCreatedAt]}>{this.formatCreatedAt(row.created_at)}</div>,
            <div class={[s.listCell, s.colGit]} attrs={{ title: gitText }}>{gitText}</div>,
            <div class={[s.listCell, s.colImage]}>
                <OverflowTooltip content={imageText} openDelay={1000}>
                    {img?.android_version && <span
                        style={{
                            lineHeight: "20px",
                            padding: "0 3px",
                            marginRight: "5px",
                            backgroundColor: download ? "#f0f9eb" : "#fef0f0",
                            borderColor: download ? "#e1f3d8" : "#fde2e2",
                            color: download ? "#67c23a" : "#f56c6c",
                            borderRadius: "3px",
                        }}
                        title={download ? this.$t("create.already_latest").toString() : this.$t("create.need_update").toString()}>
                        {download && <i class="el-icon-check" />}
                        {!download && <i class="el-icon-close" />}
                    </span>}
                    <span>{imageText}</span>
                </OverflowTooltip>
            </div>,
            <div class={[s.listCell, s.colState]}>{this.renderStatus(row)}</div>,
            <div class={[s.listCell, s.colAction]}>{this.renderAction(row)}</div>,
        ];
    }

    private renderGridView() {
        return (
            <el-checkbox-group value={this.rightChecked}>
                <div ref="gridContainer" class={s[this.config.view]}>
                    {/* 网格感知的虚拟滚动：扁平列表按 device.key 稳定标识，勾选变化只增删对应卡片，
                        其余卡片实例（含截图 canvas）原地保留，不再整屏重建，从根本上消除闪烁 */}
                    <RecycleScroller
                        items={this.data2}
                        keyField="key"
                        gridItems={this.itemsPerRow}
                        itemSize={this.gridRowHeight}
                        itemSecondarySize={this.gridItemSecondarySize}
                        class={s.scroller}
                        scopedSlots={{
                            default: ({ item }: { item: DeviceInfo; }) => this.renderGridCard(item)
                        }}
                    />
                </div>
            </el-checkbox-group>
        );
    }

    private renderGridCard(e: DeviceInfo) {
        const name = getSuffixName(e.name);
        const ipFragment = e.hostIp.split('.').slice(-2).join('.');
        const ipParts = ipFragment.split('.');
        const displayIp = (name.length > 12 && ipParts.length > 1) ? ipParts[1] : ipFragment;

        return <Column key={`parent_${e.key}`} class={[s.img_box, e.state == "running" ? s.running : s.no_run]}>
            <div style="position: relative; display: inline-block; padding: 0;" onDblclick={() => this.openAdbShell(e)}>
                <Screenshot data-key={e.key} key={e.key} device={e} />
                {e.state !== 'running' &&
                    <div class={s.power_overlay}>
                        <el-button type="primary" icon="el-icon-switch-button" circle style="font-size: 24px; padding: 15px;" nativeOnClick={(event: Event) => {
                            event.stopPropagation();
                            this.start(e);
                        }}></el-button>
                    </div>
                }
            </div>
            <Row mainAlign='space-between' crossAlign='center'>
                <el-checkbox class={s.checkbox} label={e.key} onChange={(c, event) => this.checkboxChanged(c, e)} >
                    <Row gap={5} flex crossAlign='center'>
                        <span>{`${e.index}`}</span>
                        {name === "开通VIP显示全部" ? (
                            <span
                                class={["ellipsis", s.checkbox_label]}
                                style="color: var(--main-color); cursor: pointer; text-decoration: underline;"
                                title={`${name} ${e.hostIp}`}
                                onClick={(event: Event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    this.showVipDialog();
                                }}
                            >{name}</span>
                        ) : (
                            <span class={["ellipsis", s.checkbox_label]} title={`${name} ${e.hostIp}`}>{name}</span>
                        )}
                    </Row>
                </el-checkbox>
                <Row gap={5} crossAlign='center' style={{ flexShrink: 0 }}>
                    <span
                        class={this.getHostColorIndex(e.hostIp) % 2 === 0 ? 'text-green-600' : 'text-blue-600'}
                        style={{ fontSize: '14px' }}
                    >
                        {displayIp}
                    </span>
                    {this.renderAction(e, false)}
                </Row>
            </Row>
        </Column>;
    }

    protected renderMenu(e: DeviceInfo) {

    }

    private formatAdb(adb: string) {
      /*
        // adb 格式一般是 "192.168.31.54:5005"
        const parts = adb.split(".");
        if (parts.length !== 4) return adb;

        // 取后两个字段
        const ipPart = parts[2] + "." + parts[3];   // => "31.54:5005"
        */
        return adb;
    }

    private formatCreatedAt(time: string) {
        try {
            // 格式示例：2020-11-04 11:05:24
            const [date, t] = time.split(" ");
            const parts = date.split("-");  // [2020, 11, 04]
            if (parts.length !== 3) return time;

            const month = parts[1];
            const day = parts[2];

            // 去掉秒，保留 HH:MM
            const shortTime = t.slice(0, 5);

            return `${month}-${day} ${shortTime}`;
        } catch {
            return time;
        }
    }


    public async create(data: DeviceInfo) {
        let name = getSuffixName(data.name);
        let index = name.match(/\d+$/);
        console.log(index);
        if (index) {
            name = name.replace(index[0], (parseInt(index[0]) + 1) + "");
        } else {
            name += "2";
        }
        let re = await this.$dialog(CreateDialog).show({
            hostId: data.hostId,
            info: data,
            obj: {
                name: name,
                sandbox_size: 64,
                sandbox: 1,
                width: 1080,
                height: 1920,
                dpi: 400,
                x_dpi: 400,
                y_dpi: 400,
                fps: 24,
                dns_urls: "223.5.5.5",
            },
        });
        if (re) this.$emit("changed", data.hostIp);
    }

    private async updateVm(data: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: data,
            hostId: data.hostId,
            obj: Object.assign({ name: getSuffixName(data.name) }, data.create_req),
        });
        if (re) {
            if (re.name != getSuffixName(data.name)) {
                var t = this.treeConfig.find(x => x.key == data.key);
                if (t) {
                    t.key = `${data.hostIp}-${data.index}-${getPrefixName(data.name)}${re.name}`;
                    localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
                }
            }
            this.$emit("changed", data.hostIp);
        }
    }

    @ErrorProxy({ confirm: t("confirm.rebootTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    public async reboot(data: DeviceInfo) {
        const l = this.$loading({
            lock: true,
            text: i18n.t("loading").toString(),
        });
        const imageAddress = await deviceApi.reboot(data.hostIp, data.name).finally(() => {
            l.close();
        });
        if (imageAddress) {
            const re = await this.$dialog(PullImageDialog).show({
                hostIp: data.hostIp,
                imageAddress: imageAddress,
            });
            if (re?.canceled) return false;
            if (re?.error) throw new Error(re.error);
            await deviceApi.reboot(data.hostIp, data.name);
        }
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: t("confirm.resetTitle"), success: i18n.t("success") })
    private async reset(data: DeviceInfo) {
        const l = this.$loading({
            lock: true,
            text: i18n.t("loading").toString(),
        });
        const imageAddress = await deviceApi.reset(data.hostIp, data.name).finally(() => {
            l.close();
        });
        if (imageAddress) {
            const re = await this.$dialog(PullImageDialog).show({
                hostIp: data.hostIp,
                imageAddress: imageAddress,
            });
            if (re?.canceled) return false;
            if (re?.error) throw new Error(re.error);
            await deviceApi.reset(data.hostIp, data.name);
        }
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: t("confirm.shutdownTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async shutdown(data: DeviceInfo) {
        await deviceApi.shutdown(data.hostIp, data.name);
        this.$emit("changed", data.hostIp);
    }

    // 安卓14与安卓12容器共享宿主机内核，二者不能同时正常运行：宿主机上已有某一版本的云机在跑时，
    // 再启动另一版本的云机，内核仍处于原版本模式，新启动的云机大概率异常。这里只是提示，
    // 不拦截启动请求——用户可以先看效果，按提示自行处理（关另一版本云机后重启这台）。两个方向
    // （安卓12运行中启动安卓14 / 安卓14运行中启动安卓12）共用同一套判断，仅提示文案不同。
    private hasRunningConflictingSibling(data: DeviceInfo, startedIsAndroid14: boolean): boolean {
        const host = this.hosts.find(h => h.address === data.hostIp);
        return !!host?.devices?.some(d => {
            if (d.state !== "running" || d.key === data.key) return false;
            const version = this.images.find(img => img.address === d.image_addr)?.android_version;
            return startedIsAndroid14 ? version !== 14 : version === 14;
        });
    }

    @ErrorProxy({ confirm: t("confirm.startTitle"), success: i18n.t("success") })
    private async start(data: DeviceInfo) {
        const l = this.$loading({
            lock: true,
            text: i18n.t("loading").toString(),
        });
        try {
            const startedIsAndroid14 = this.images.find(img => img.address === data.image_addr)?.android_version === 14;
            const shouldWarnAndroidConflict = this.hasRunningConflictingSibling(data, startedIsAndroid14);
            const imageAddress = await deviceApi.start(data.hostIp, data.name).finally(() => {
                l.close();
            });
            if (imageAddress) {
                const re = await this.$dialog(PullImageDialog).show({
                    hostIp: data.hostIp,
                    imageAddress: imageAddress,
                });
                if (re?.canceled) return false;
                if (re?.error) throw new Error(re.error);
                await deviceApi.start(data.hostIp, data.name);
            }
            if (shouldWarnAndroidConflict) {
                this.$message.warning(this.$t(startedIsAndroid14 ? "android12ConflictOnStart" : "android14ConflictOnStart").toString());
            }
            this.$emit("changed", data.hostIp);
        } catch (e) {
            if (e instanceof VipImageRestrictedError) {
                // VIP镜像受限，弹出确认框引导用户开通VIP
                await this.$confirm(e.message, this.$t("tip").toString(), {
                    confirmButtonText: this.$t("vip.goToPurchase").toString(),
                    cancelButtonText: this.$t("confirm.cancel").toString(),
                    type: 'warning'
                }).then(async () => {
                    await this.showVipDialog();
                }).catch(() => {
                    // 用户取消
                });
                // 返回 false 阻止 ErrorProxy 显示成功消息
                return false;
            } else {
                throw e;
            }
        }
    }

    @ErrorProxy({ confirm: t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async delete(data: DeviceInfo) {
        await deviceApi.delete(data.hostIp, data.name);
        this.treeConfig.removeWhere(x => x.key == data.key);
        localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
        this.$emit("changed", data.hostIp);
    }

    private async rename(data: DeviceInfo) {
        var re = await this.$dialog(RenameDialog).show(data);
        if (re) {
            var index = this.rightChecked.findIndex(x => x == data.key);
            if (index > -1) {
                this.rightChecked.splice(index, 1);
                (async () => {
                    const newKey = `${data.hostIp}-${data.index}-${re}`;
                    let newData: DeviceInfo | undefined = undefined;
                    let count = 0;
                    do {
                        newData = this.data2.find(x => x.key == newKey);
                        if (!newData) await sleep(50);
                        count++;
                    } while (!newData && count < 20);
                    if (newData) {
                        this.rightChecked.push(newData.key!);
                    }
                })();
            }
            var t = this.treeConfig.find(x => x.key == data.key);
            if (t) {
                t.key = `${data.hostIp}-${data.index}-${re}`;
                localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
            }
            this.$emit("changed", data.hostIp);
        }
    }

    private async fileBrowser(data: DeviceInfo) {
        await this.$dialog(FilelistDialog).show(data);
    }
    private apiDoc(data: DeviceInfo) {
        window.open(`http://${data.hostIp}/api`);
    }
    private async changeModel(data: DeviceInfo) {
        var dialog = this.$dialog(ModelSelectotDialog);
        dialog.immediateSubmit = true;
        dialog.device = data;
        await dialog.show();
    }
    private async setS5Proxy(data: DeviceInfo) {
        var re = await this.$dialog(S5setDialog).show([data]);
        if (re) this.$emit("changed", data.hostIp);

    }
    private async hostDetails(data: DeviceInfo) {
        await this.$dialog(VmDetailDialog).show(data);
    }

    // 隐藏功能：预览图连续双击弹出交互式 adb shell 终端，仅在云机运行中生效
    private openAdbShell(data: DeviceInfo) {
        if (data.state !== 'running') return;
        openAdbShell(this, data);
    }

    private async showVipDialog() {
        const result = await this.$dialog(VipHostSelectDialog).show({
            hosts: this.hosts
        });
        if (result) {
            this.$emit('changed');
        }
    }

    @ErrorProxy({ confirm: t("confirm.backupTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async backupVm(data: DeviceInfo) {
        let url = await deviceApi.exportDocker(data.hostIp, data.name);
        let link = makeVmApiUrl("host/download", data.hostIp) + `?path=${url}`;
        location.href = link;
    }

    private async cloneVm(data: DeviceInfo) {
        let re = await this.$dialog(CloneVmDialog).show(data);
        if (re) {
            // 移动后云机的实例位 index 与名称（内嵌 index）都会变化，导致 key 改变，
            // 需同步更新已持久化的 TreeConfig，否则刷新页面后因 key 不匹配导致选中状态丢失
            var t = this.treeConfig.find(x => x.key == data.key);
            if (t) {
                // 移动保留同一 deviceId，仅替换前缀中的实例位编号并使用新名称
                const newPrefix = getPrefixName(data.name).replace(/\d+([-_])$/, `${re.index}$1`);
                t.key = `${data.hostIp}-${re.index}-${newPrefix}${re.dst_name}`;
                localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
            }
            this.$emit("changed", data.hostIp);
        }
    }

    private async exportModel(data: DeviceInfo) {
        await this.$dialog(ExportModelDialog).show(data);
    }

    private async importModel(data: DeviceInfo) {
        const ok = await this.$dialog(ImportModelDialog).show(data);
        // 后端已处理云机重启，这里仅刷新列表
        if (ok) this.$emit("changed", data.hostIp);
    }

    private async screenMirror(data: DeviceInfo) {
        let re = await this.$dialog(ScreenMirrorDialog).show(data);
        if (re) this.$emit("changed", data.hostIp);
    }

    private async shake(data: DeviceInfo) {
        await this.$dialog(ShakeDialog).show(data);
    }


    private async androidSdkApi(data: DeviceInfo) {
        window.open("http://" + data.android_sdk, "_blank");
    }

    private async selectFile(data: DeviceInfo) {
        await this.$dialog(UploadFileDialog).show([data]);

    }

    @ErrorProxy({ success: i18n.t("upload.success") })
    protected async upload(data: DeviceInfo, file: File) {
        console.log("upload into");
        if (!data.macvlan) {
            await deviceApi.upload(data.hostIp, data.name, `/sdcard/${file.name}`, file);
        } else {
            console.log("upload into1");
            await deviceApi.uploadMacvlan(data.android_sdk, `/sdcard/${file.name}`, file);
        }
    }

    private renderAction(row: DeviceInfo, hasBtn: boolean = true) {
        const isListView = this.config.view === 'list';
        const renderBtn = () => {
            switch (row.state) {
                case 'running':
                    return <TextButton text={this.$t("menu.shutdown")} onClick={() => this.shutdown(row)} />;
                case 'stopped':
                case 'exited':
                case 'created':
                    return <TextButton text={this.$t("menu.start")} onClick={() => this.start(row)} />;
            }
            return <TextButton text={this.$t("createVm")} onClick={() => this.create(row)} />;
        };
        return (
            <Row gap={10} crossAlign='center'>
                {hasBtn && renderBtn()}
                {isListView && <TextButton text={this.$t("menu.create")} onClick={() => this.create(row)} />}
                {row.state !== '' && <el-dropdown trigger="click">

                    <div style="cursor: pointer;">
                        <Icon icon={moreVert} width="16" height="16" />
                    </div>
                    <el-dropdown-menu slot="dropdown">
                        {!isListView && <el-dropdown-item nativeOnClick={() => this.create(row)}>{this.$t("createVm")}</el-dropdown-item>}
                        <el-dropdown-item disabled={row.state == 'running'} nativeOnClick={() => this.start(row)}>{this.$t("menu.start")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.shutdown(row)}>{this.$t("menu.shutdown")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reboot(row)}>{this.$t("menu.reboot")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reset(row)}>{this.$t("menu.reset")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.delete(row)}>{this.$t("menu.delete")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.rename(row)}>{this.$t("menu.rename")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.updateVm(row)}>{this.$t("menu.updateVm")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.backupVm(row)}>{this.$t("menu.backup")}</el-dropdown-item>
                        {
                          /* V3版本不需要导入和导出机型的功能，走另外接口导出到sdcard
                        <el-dropdown-item nativeOnClick={() => this.exportModel(row)}>{this.$t("menu.exportModel")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.importModel(row)}>{this.$t("menu.importModel")}</el-dropdown-item>
                          */
                        }
                        <el-dropdown-item nativeOnClick={() => this.cloneVm(row)}>{this.$t("menu.clone")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.selectFile(row)}>{this.$t("menu.upload")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.screenMirror(row)}>{this.$t("menu.screenMirror")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.shake(row)}>{this.$t("menu.shake")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.fileBrowser(row)}>{this.$t("menu.fileBrowser")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.hostDetails(row)}>{this.$t("menu.hostDetails")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.setS5Proxy(row)}>{this.$t("menu.setS5Proxy")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.androidSdkApi(row)}>{this.$t("menu.androidSdkApi")}</el-dropdown-item>
                    </el-dropdown-menu>
                </el-dropdown>
                }

            </Row>
        );
    }
}

interface IProps {

}

interface IEvents {
    onSelectChange(selectedRows: DeviceInfo[]): void;
    onChanged(hostIp: string): void;
}

function t(t: string) {
    return function (self: DeviceList, data: DeviceInfo) {
        return i18n.t(t, {
            0: `${data.hostIp}`,
            1: `${data.index}`,
            2: `${getSuffixName(data.name)}`,
        });
    };
}
