import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Trash2, Phone, MapPin, Users, Truck, Search } from "lucide-react";
import { useGetCustomers, useGetSuppliers, useDeleteCustomer, useDeleteSupplier, getGetCustomersQueryKey, getGetSuppliersQueryKey, type ContactPerson } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ContactModal } from "../components/ContactModal";

interface Props {
  type: "customers" | "suppliers";
}

export default function ContactsPage({ type }: Props) {
  const queryClient = useQueryClient();
  const isCustomers = type === "customers";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContactPerson | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: customers, isLoading: loadingCustomers } = useGetCustomers({
    query: { queryKey: getGetCustomersQueryKey(), enabled: isCustomers },
  });
  const { data: suppliers, isLoading: loadingSuppliers } = useGetSuppliers({
    query: { queryKey: getGetSuppliersQueryKey(), enabled: !isCustomers },
  });

  const data = isCustomers ? customers : suppliers;
  const isLoading = isCustomers ? loadingCustomers : loadingSuppliers;

  const deleteCustomer = useDeleteCustomer({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }); setDeletingId(null); } }
  });
  const deleteSupplier = useDeleteSupplier({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() }); setDeletingId(null); } }
  });

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    setDeletingId(id);
    if (isCustomers) {
      deleteCustomer.mutate({ id });
    } else {
      deleteSupplier.mutate({ id });
    }
  };

  const filtered = data?.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.neighborhood?.toLowerCase().includes(q) ||
      item.phone_numbers.some((p) => p.includes(q))
    );
  });

  const openAdd = () => { setEditingItem(null); setIsModalOpen(true); };
  const openEdit = (item: ContactPerson) => { setEditingItem(item); setIsModalOpen(true); };

  const typeLabel = isCustomers ? "Customers" : "Suppliers";
  const singleLabel = isCustomers ? "Customer" : "Supplier";
  const Icon = isCustomers ? Users : Truck;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${typeLabel.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-md shadow-black/10"
        >
          <Plus className="w-4 h-4" />
          <span>Add {singleLabel}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Icon className="w-9 h-9 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {searchQuery ? "No results found" : `No ${typeLabel.toLowerCase()} yet`}
          </h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            {searchQuery ? `Nothing matching "${searchQuery}".` : `Start by adding your first ${singleLabel.toLowerCase()}.`}
          </p>
          {!searchQuery && (
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus className="w-4 h-4" />
              <span>Add {singleLabel}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
                      {type === "suppliers" && (item as any).supplier_type === "capital_owner" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          رأس مال
                        </span>
                      )}
                      {type === "suppliers" && (item as any).supplier_type === "consignment" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                          كونسينيمنت
                        </span>
                      )}
                    </div>
                    {item.neighborhood && (
                      <p className="text-xs text-gray-500 flex items-center mt-0.5 gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.neighborhood}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {item.address_detail && (
                <p className="text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded-lg leading-relaxed">
                  {item.address_detail}
                </p>
              )}

              {item.phone_numbers.length > 0 && (
                <div className="space-y-1.5">
                  {item.phone_numbers.map((phone, i) => (
                    <a
                      key={i}
                      href={`tel:${phone}`}
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-black transition-colors"
                    >
                      <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <span className="font-mono text-xs">{phone}</span>
                    </a>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="text-xs text-gray-400 mt-3 italic border-t border-gray-50 pt-3">
                  {item.notes}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={editingItem}
        type={type}
      />
    </div>
  );
}
