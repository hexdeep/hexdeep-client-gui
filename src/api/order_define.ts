import { HostInfo } from "./device_define";

export interface OrderInfo {
    status: number;
    id: string;
    payment_amount: number;
    created_at: string;
    updated_at: string;
    //detail: string;
    detail: OrderDetail;
}

export interface OrderDetail {
    device_ids: string;
    id: number;
    name: string;
    price: number;
    rental_hours: number;
    created_at: string;
    updated_at: string;
}

export interface RentalInfo {
    index: number;
    rental_start_time: string;
    rental_end_time: string;
    current_time: string;
    state?: string;
}

export interface RentalRecord {
    device_id: string;
    device_indexes: RentalInfo[];
}

export interface HostDetail {
    host: HostInfo;
    rentals: RentalInfo[];
}

export interface PackageInfo {
    id: number;
    name: string;
    english_name: string;
    price: number;
    rental_hour: number;
}

export interface PurchaseInfo {
    package_id: number;
    hosts: Map<HostInfo, number[]>;
}

export interface PurchaseResult {
    url: string;
    order_id: string;
    current_time: string;
    expire_time: string;
}