using Supabase;
using System.Threading.Tasks;

namespace BarManager.Services {
    public class SupabaseService {
        private const string Url = "https://kfdtfzxmdamugokdjkro.supabase.co";
        private const string Key = "sb_publishable_DTdFzGhL1iW33zuCieeoeA_OvvhjAfn";

        public async Task Initialize() {
            var client = new Supabase.Client(Url, Key);
            await client.InitializeAsync();
        }
    }
}