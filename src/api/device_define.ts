
export interface DeviceInfo {
    key?: string;
    name: string;
    state: string;
    data: string;
    index: number;
    created_at: string;
    image_addr: string;
    image_digest: string;
    git_commit_id: string;
    ip: string;
    macvlan: boolean;
    android_sdk: string;
    adb: string;
    subnet: string;
    hostIp: string;
    hostId: string;
    create_req: DeviceDetail;
}

export interface HostInfo {
    address: string;
    device_id: string;
    remark: string;
    devices: DeviceInfo[];
    has_error?: boolean;
    disk?: string;
}

export interface MyTreeNode {
    key: string;
    label: string;
    opened: boolean;
    selected: boolean;
    children?: MyTreeNode[];
    value?: any;
}

export interface DeviceDetail {
    custom_image?: string; // 扩展字段 自定义镜像地址
    image_addr?: string;//	镜像地址
    width?: number; //	屏幕宽度
    height?: number;//	屏幕高度
    dpi?: number;   //	解析度
    fps?: number;   //	分辨率
    dns_urls?: string;  //	dns服务器地址,例如:223.5.5.5,8.8.8.8
    subnet?: string;
    memory?: number;
}

export interface CreateParam extends S5setParam, DeviceDetail {
    suffix_name?: string;
    num?: number;
    index?: number;
    name: string;
    sandbox?: number;   //	沙盒模式:0,禁用;1,启用
    sandbox_size?: number;  //	沙盒大小 单位GB 默认16GB
    mac_vlan?: number;  //	独立ip模式:0,禁用；1，启用
    ip?: string;    //	ip:mac_vlan模式为1时，必须指定
    model_id?: number;  //	机型id:值为0时，随机机型；大于0时，固定机型
    subnet?: string;
    memory?: number; // 内存大小
    docker_registry?: string;

    // s5_domain_mode?: number;//	1,本地域名解析;2,服务端域名解析（默认）
    // s5_ip?: string; //	s5代理ip
    // s5_port?: number;   //	s5代理端口
    // s5_user?: string;   //	s5代理用户名
    // s5_pwd?: string;//	s5代理密码
    // 
}

export interface ImageInfo {
    address: string;
    name: string;
    android_version: number;
    download: boolean;
    id: string;
    created_at: string;
    updated_at: string;
}

export interface SDKImageInfo {
    version: string;
    address: string;
    id: string;
    created_at: string;
    updated_at: string;
}

export interface SDKImagesRes {
    current_version: string;
    git_commit_id: string;
    images: SDKImageInfo[];

}

export interface S5setParam {
    isOpenProxy?: boolean;
    engine?: number;//	1,tun2socks;2,singbox
    protocol_type?: number;//	 socks5=1 shadowssocks=2 vmess=3 hysteria2=4
    dns_mode?: number;//	1,本地域名解析;2,服务端域名解析（默认）
    host?: string; //	代理服务器地址
    address?: string;  //协议地址 singbox模式下使用
    port?: string;   //	代理服务器端口
    username?: string;   //	用户名
    password?: string;//	密码   
    udp_over_tcp?: number; //	1,启用;0,禁用
}

export interface DockerEditParam {
    isUpdate?: boolean;
    info: DeviceInfo;
    hostId: string;
    obj: CreateParam;
}

export interface DockerBatchCreateParam {
    maxNum: number;
    hostIp: string[];
    obj: CreateParam;
}

export interface FilelistInfo {
    file: string;
    name: string;
    length: number;
    flag: boolean;
}


export interface SelectedDevice {
    hostIp: string;
    index: number;
    obj?: DeviceInfo;
    children?: DeviceInfo[] | null;
    hasChildren?: boolean;
}

export interface HostDetailInfo {
    device_id: string,
    cpu: string,
    disk_percent: string,
    disk_total: number,
    mem_percent: string,
    mem_total: number,
    swap_percent: string,
    swap_total: number,
    temperature: string;
    git_commit_id: string;
    disk?: string;
    remark: string;
}

export interface ImportVmParam {
    host: HostInfo;
    index: number;
    name: string;
    local: string;
}

export interface CloneVmParam {
    index: number;
    dst_name: string;
    remove: boolean;
}

export interface MyConfig {
    view: string;
    refreshDuration: number;
    filterState: string;
    suffixName: string;
    filterNameOrIp: string;
}

export interface TreeConfig {
    key: string;
    opened: boolean;
    selected: boolean;
}


export const ProxyProtocolTypeOps: Record<number, any> = ({
    1: { label: "socks5" },
    2: { label: "shadowssocks", engine: 2 },
    3: { label: "vmess", engine: 2 },
    4: { label: "hysteria2", engine: 2 },
});

export interface DiskListInfo {
    /**
     * 当前正在使用的磁盘，当前正在使用的磁盘
     */
    current_disk: string;
    /**
     * 磁盘列表，磁盘列表
     */
    list: DiskItem[];
    [property: string]: any;
}

export interface DiskItem {
    /**
     * 是否可用，是否可用
     */
    enable: boolean;
    /**
     * 磁盘名称，磁盘名称
     */
    name: string;
    [property: string]: any;
}

export interface ClearGarbageReq {
    files: string[];
}

export interface DiscoverInfo {
    /**
     * 自动模式，自动模式
     */
    auto: boolean;
    /**
     * 主机ip列表
     */
    host_ips: string[];
}