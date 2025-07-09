
export interface DeviceInfo {
    key?: string;
    name: string;
    state: string;
    data: string;
    index: number;
    created_at: string;
    image_addr: string;
    ip: string;
    adb: string;
    hostIp: string;
    create_req: DeviceDetail;
}

export interface HostInfo {
    address: string;
    device_id: string;
    devices: DeviceInfo[];
    has_error?: boolean;
}

export interface DeviceDetail {
    image_addr?: string;//	镜像地址
    width?: number; //	屏幕宽度
    height?: number;//	屏幕高度
    dpi?: number;   //	解析度
    fps?: number;   //	分辨率
    dns_urls?: string;  //	dns服务器地址,例如:223.5.5.5,8.8.8.8
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
    images: SDKImageInfo[];

}


export interface S5setParam {
    s5_domain_mode?: number;//	1,本地域名解析;2,服务端域名解析（默认）
    s5_ip?: string; //	s5代理ip
    s5_port?: number;   //	s5代理端口
    s5_user?: string;   //	s5代理用户名
    s5_pwd?: string;//	s5代理密码
    //dns_urls?: string;  //	dns服务器地址,例如:223.5.5.5,8.8.8.8
}

export interface DockerEditParam {
    isUpdate?: boolean;
    info: DeviceInfo;
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
    cpu: string,
    disk_percent: string,
    disk_total: number,
    mem_percent: string,
    mem_total: number,
    swap_percent: string,
    swap_total: number,
    temperature: string;
}

// export interface TableData extends DeviceInfo  {
//     instances: number;
//     index: number;
//     name: string;
//     ip: string;
//     deviceIp: string;
//     imgVer: string;
//     createdAt: string;
//     status: string;
// }

